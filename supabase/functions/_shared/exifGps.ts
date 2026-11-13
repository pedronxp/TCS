/**
 * supabase/functions/_shared/exifGps.ts
 *
 * Leitura e escrita de metadados EXIF GPS em imagens JPEG.
 *
 * Motivo de existir: uma foto só é georreferenciada de verdade quando as
 * coordenadas viajam dentro do próprio arquivo. O TCS não possui convênio com
 * o órgão municipal, então a prova técnica da vistoria não pode depender de
 * selo institucional — ela precisa se sustentar sozinha, em qualquer lugar,
 * para qualquer auditor (inclusive com `exiftool`, sem o TCS).
 *
 * Por isso o módulo é propositalmente livre de React Native, Expo e Deno:
 * o app (captura) e a Edge Function (geração do PDF oficial) consomem
 * exatamente a mesma implementação, e os testes rodam em Node puro.
 *
 * Referência: TIFF/EXIF 6.0 (tags GPS IFD 0x0000–0x001F) e APP1 JPEG.
 */

// ─── Tipos públicos ────────────────────────────────────────────────────────

export interface GpsExifInput {
  latitude: number;
  longitude: number;
  /** Altitude em metros acima do nível do mar (opcional). */
  altitudeMeters?: number | null;
  /** Precisão horizontal estimada em metros (opcional). */
  accuracyMeters?: number | null;
  /** Instante da captura (ISO ou Date). */
  capturedAt?: string | Date | null;
  /** Software que produziu o registro — identificação da cadeia de custódia. */
  software?: string | null;
  /** Descrição livre (JSON de metadados da cadeia de custódia). */
  description?: string | null;
}

export interface ExifGeo {
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  /** Precisão horizontal em metros, lida da tag GPSHPositioningError. */
  accuracyMeters: number | null;
  /** Instante da captura em ISO UTC, reconstruído das tags de data/hora GPS. */
  capturedAtUtc: string | null;
  /** Data/hora original em string EXIF (sem fuso). */
  dateTimeOriginal: string | null;
  software: string | null;
  description: string | null;
  /** Método de processamento declarado pela câmera (tag GPSProcessingMethod). */
  processingMethod: string | null;
}

// ─── Constantes TIFF/EXIF ──────────────────────────────────────────────────

const TIFF_TYPE_BYTE = 1;
const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_RATIONAL = 5;

const TIFF_TYPE_SIZE: Record<number, number> = {
  [TIFF_TYPE_BYTE]: 1,
  [TIFF_TYPE_ASCII]: 1,
  [TIFF_TYPE_SHORT]: 2,
  [TIFF_TYPE_LONG]: 4,
  [TIFF_TYPE_RATIONAL]: 8,
};

const TAG_IMAGE_DESCRIPTION = 0x010e;
const TAG_SOFTWARE = 0x0131;
const TAG_DATE_TIME = 0x0132;
const TAG_GPS_IFD_POINTER = 0x8825;

const GPS_TAG_VERSION_ID = 0x0000;
const GPS_TAG_LATITUDE_REF = 0x0001;
const GPS_TAG_LATITUDE = 0x0002;
const GPS_TAG_LONGITUDE_REF = 0x0003;
const GPS_TAG_LONGITUDE = 0x0004;
const GPS_TAG_ALTITUDE_REF = 0x0005;
const GPS_TAG_ALTITUDE = 0x0006;
const GPS_TAG_TIME_STAMP = 0x0007;
const GPS_TAG_PROCESSING_METHOD = 0x001b;
const GPS_TAG_DATE_STAMP = 0x001d;
const GPS_TAG_POSITIONING_ERROR = 0x001f;

const GPS_VERSION_ID = [2, 3, 0, 0];
const RATIONAL_DENOMINATOR = 10000;
const HEADER_SIZE = 8;
const IFD_HEADER_SIZE = 2;
const IFD_ENTRY_SIZE = 12;
const IFD_NEXT_POINTER_SIZE = 4;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const APP1_MARKER = 0xe1;
const SOI_MARKER = 0xd8;
const EOI_MARKER = 0xd9;
const SOS_MARKER = 0xda;

// ─── Utilidades de bytes ────────────────────────────────────────────────────

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function rational(numerator: number, denominator: number): number[] {
  return [...u32(numerator), ...u32(denominator)];
}

/** Converte texto em bytes ASCII; caracteres fora de ASCII viram '?'. */
function asciiBytes(text: string): number[] {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    out.push(code >= 0x20 && code <= 0x7e ? code : 0x3f);
  }
  out.push(0); // terminador NUL
  return out;
}

function decodeAscii(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    if (byte === 0) break;
    out += String.fromCharCode(byte);
  }
  return out;
}

function bytesEqual(bytes: Uint8Array, expected: number[]): boolean {
  if (bytes.length < expected.length) return false;
  return expected.every((value, index) => bytes[index] === value);
}

// ─── Construção do bloco APP1 ──────────────────────────────────────────────

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  /** Valor embutido no campo de 4 bytes (tipos de tamanho <= 4). */
  inline?: number[];
  /** Valor que precisa de área de dados própria. */
  data?: number[];
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === SOI_MARKER;
}

/**
 * Converte graus decimais em graus/minutos/segundos no formato EXIF
 * (segundos com denominador 10000).
 */
function toDegreesMinutesSeconds(value: number): [number, number, number] {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return [degrees, minutes, Math.round(seconds * RATIONAL_DENOMINATOR)];
}

function utcParts(date: Date): {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
} {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function exifDateString(date: Date): string {
  const p = utcParts(date);
  return `${p.year}:${pad2(p.month)}:${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

function gpsDateString(date: Date): string {
  const p = utcParts(date);
  return `${p.year}:${pad2(p.month)}:${pad2(p.day)}`;
}

/**
 * Monta o payload APP1 (sem o marcador FF E1): "Exif\0\0" + bloco TIFF com
 * IFD0 e GPS IFD.
 */
export function buildExifApp1Payload(input: GpsExifInput): Uint8Array {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error('Coordenadas inválidas para metadados EXIF');
  }
  if (input.latitude < -90 || input.latitude > 90) {
    throw new Error('Latitude fora do intervalo válido');
  }
  if (input.longitude < -180 || input.longitude > 180) {
    throw new Error('Longitude fora do intervalo válido');
  }

  const capturedAt = input.capturedAt
    ? new Date(input.capturedAt)
    : new Date();
  if (Number.isNaN(capturedAt.getTime())) {
    throw new Error('Data de captura inválida');
  }

  const [latDeg, latMin, latSec] = toDegreesMinutesSeconds(input.latitude);
  const [lonDeg, lonMin, lonSec] = toDegreesMinutesSeconds(input.longitude);
  const latitudeRef = input.latitude >= 0 ? 'N' : 'S';
  const longitudeRef = input.longitude >= 0 ? 'E' : 'W';
  const parts = utcParts(capturedAt);

  const softwareText = input.software?.trim() || 'TCS';
  const descriptionText = input.description?.trim() || '';

  // IFD0 — as entradas devem estar em ordem crescente de tag.
  const ifd0Entries: IfdEntry[] = [];
  if (descriptionText) {
    const data = asciiBytes(descriptionText);
    ifd0Entries.push({ tag: TAG_IMAGE_DESCRIPTION, type: TIFF_TYPE_ASCII, count: data.length, data });
  }
  const softwareData = asciiBytes(softwareText);
  ifd0Entries.push({
    tag: TAG_SOFTWARE,
    type: TIFF_TYPE_ASCII,
    count: softwareData.length,
    inline: softwareData.length <= 4 ? softwareData : undefined,
    data: softwareData.length <= 4 ? undefined : softwareData,
  });
  const dateTimeData = asciiBytes(exifDateString(capturedAt));
  ifd0Entries.push({ tag: TAG_DATE_TIME, type: TIFF_TYPE_ASCII, count: dateTimeData.length, data: dateTimeData });
  ifd0Entries.push({ tag: TAG_GPS_IFD_POINTER, type: TIFF_TYPE_LONG, count: 1, inline: [0, 0, 0, 0] });

  // GPS IFD.
  const gpsEntries: IfdEntry[] = [
    { tag: GPS_TAG_VERSION_ID, type: TIFF_TYPE_BYTE, count: 4, inline: GPS_VERSION_ID },
    { tag: GPS_TAG_LATITUDE_REF, type: TIFF_TYPE_ASCII, count: 2, inline: asciiBytes(latitudeRef) },
    {
      tag: GPS_TAG_LATITUDE,
      type: TIFF_TYPE_RATIONAL,
      count: 3,
      data: [...rational(latDeg, 1), ...rational(latMin, 1), ...rational(latSec, RATIONAL_DENOMINATOR)],
    },
    { tag: GPS_TAG_LONGITUDE_REF, type: TIFF_TYPE_ASCII, count: 2, inline: asciiBytes(longitudeRef) },
    {
      tag: GPS_TAG_LONGITUDE,
      type: TIFF_TYPE_RATIONAL,
      count: 3,
      data: [...rational(lonDeg, 1), ...rational(lonMin, 1), ...rational(lonSec, RATIONAL_DENOMINATOR)],
    },
  ];

  if (typeof input.altitudeMeters === 'number' && Number.isFinite(input.altitudeMeters)) {
    const belowSeaLevel = input.altitudeMeters < 0;
    gpsEntries.push({ tag: GPS_TAG_ALTITUDE_REF, type: TIFF_TYPE_BYTE, count: 1, inline: [belowSeaLevel ? 1 : 0] });
    gpsEntries.push({
      tag: GPS_TAG_ALTITUDE,
      type: TIFF_TYPE_RATIONAL,
      count: 1,
      data: rational(Math.round(Math.abs(input.altitudeMeters) * 100), 100),
    });
  }

  gpsEntries.push({
    tag: GPS_TAG_TIME_STAMP,
    type: TIFF_TYPE_RATIONAL,
    count: 3,
    data: [...rational(parts.hour, 1), ...rational(parts.minute, 1), ...rational(parts.second, 1)],
  });

  const processingMethod = 'TCS';
  const processingData = asciiBytes(processingMethod);
  gpsEntries.push({
    tag: GPS_TAG_PROCESSING_METHOD,
    type: TIFF_TYPE_ASCII,
    count: processingData.length,
    inline: processingData.length <= 4 ? processingData : undefined,
    data: processingData.length <= 4 ? undefined : processingData,
  });

  gpsEntries.push({ tag: GPS_TAG_DATE_STAMP, type: TIFF_TYPE_ASCII, count: 11, data: asciiBytes(gpsDateString(capturedAt)) });

  if (typeof input.accuracyMeters === 'number' && Number.isFinite(input.accuracyMeters)) {
    gpsEntries.push({
      tag: GPS_TAG_POSITIONING_ERROR,
      type: TIFF_TYPE_RATIONAL,
      count: 1,
      data: rational(Math.max(0, Math.round(input.accuracyMeters * 100)), 100),
    });
  }

  const ifd0Size = IFD_HEADER_SIZE + ifd0Entries.length * IFD_ENTRY_SIZE + IFD_NEXT_POINTER_SIZE;
  const gpsIfdOffset = HEADER_SIZE + ifd0Size;
  const gpsIfdSize = IFD_HEADER_SIZE + gpsEntries.length * IFD_ENTRY_SIZE + IFD_NEXT_POINTER_SIZE;
  let dataOffset = gpsIfdOffset + gpsIfdSize;

  // Reserva espaço na área de dados para os valores que não cabem em 4 bytes.
  const dataBlocks: Array<{ offset: number; bytes: number[] }> = [];
  const assignData = (entry: IfdEntry): void => {
    if (!entry.data) return;
    if (dataOffset % 2 !== 0) dataOffset += 1; // alinhamento em word
    entry.inline = u32(dataOffset);
    dataBlocks.push({ offset: dataOffset, bytes: entry.data });
    dataOffset += entry.data.length;
  };

  for (const entry of ifd0Entries) assignData(entry);
  for (const entry of gpsEntries) assignData(entry);

  // Preenche o ponteiro do GPS IFD dentro do IFD0.
  const gpsPointerEntry = ifd0Entries.find((entry) => entry.tag === TAG_GPS_IFD_POINTER);
  if (gpsPointerEntry) gpsPointerEntry.inline = u32(gpsIfdOffset);

  const out: number[] = [...EXIF_HEADER];
  out.push(0x49, 0x49); // "II" — little endian
  out.push(0x2a, 0x00); // magic 42
  out.push(...u32(HEADER_SIZE));

  const serializeIfd = (entries: IfdEntry[]): number[] => {
    const bytes: number[] = [...u16(entries.length)];
    for (const entry of entries) {
      bytes.push(...u16(entry.tag));
      bytes.push(...u16(entry.type));
      bytes.push(...u32(entry.count));
      const inline = entry.inline ?? [0, 0, 0, 0];
      // O campo de valor tem 4 bytes fixos; valores menores são alinhados à
      // esquerda e completados com zero.
      bytes.push(...inline.slice(0, 4));
      for (let pad = inline.length; pad < 4; pad += 1) bytes.push(0);
    }
    bytes.push(0, 0, 0, 0); // próximo IFD: inexistente
    return bytes;
  };

  out.push(...serializeIfd(ifd0Entries));
  out.push(...serializeIfd(gpsEntries));

  // A área de dados respeita os offsets calculados: o padding de alinhamento
  // precisa ser materializado, senão os blocos seguintes ficariam deslocados.
  // Os offsets são relativos ao início do bloco TIFF (sem o cabeçalho "Exif").
  const tiffBase = EXIF_HEADER.length;
  for (const block of dataBlocks) {
    while (out.length < tiffBase + block.offset) out.push(0);
    out.push(...block.bytes);
  }

  return new Uint8Array(out);
}

// ─── Injeção no JPEG ───────────────────────────────────────────────────────

interface JpegSegment {
  marker: number;
  /** Índice do primeiro byte do marcador (FF XX). */
  start: number;
  /** Índice do primeiro byte após o segmento. */
  end: number;
  /** Payload do APP1, quando aplicável. */
  payload?: Uint8Array;
}

function readSegments(jpeg: Uint8Array): JpegSegment[] {
  const segments: JpegSegment[] = [];
  let offset = 2; // após o SOI
  while (offset + 1 < jpeg.length) {
    if (jpeg[offset] !== 0xff) break;
    const marker = jpeg[offset + 1];
    if (marker === 0xff) {
      offset += 1; // byte de preenchimento
      continue;
    }
    if (marker === SOI_MARKER || marker === EOI_MARKER || marker === SOS_MARKER || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({ marker, start: offset, end: offset + 2 });
      if (marker === SOS_MARKER || marker === EOI_MARKER) break;
      offset += 2;
      continue;
    }
    if (offset + 3 >= jpeg.length) break;
    const length = (jpeg[offset + 2] << 8) | jpeg[offset + 3];
    const end = offset + 2 + length;
    const segment: JpegSegment = { marker, start: offset, end };
    if (marker === APP1_MARKER) {
      segment.payload = jpeg.slice(offset + 4, end);
    }
    segments.push(segment);
    if (end <= offset) break;
    offset = end;
  }
  return segments;
}

function isExifApp1(segment: JpegSegment): boolean {
  return segment.marker === APP1_MARKER && !!segment.payload && bytesEqual(segment.payload, EXIF_HEADER);
}

/**
 * Injeta (ou substitui) o bloco EXIF GPS dentro de uma imagem JPEG.
 *
 * A inserção respeita a ordem recomendada: APP0 JFIF quando existe, APP1 Exif
 * em seguida. Um APP1 Exif anterior é removido para não duplicar metadados.
 */
export function injectExifSegment(jpeg: Uint8Array, app1Payload: Uint8Array): Uint8Array {
  if (!isJpeg(jpeg)) {
    throw new Error('Arquivo não é um JPEG válido');
  }
  const segments = readSegments(jpeg);
  const existing = segments.find(isExifApp1);

  const app1Length = app1Payload.length + 2;
  const app1 = new Uint8Array([
    0xff, APP1_MARKER,
    (app1Length >>> 8) & 0xff, app1Length & 0xff,
    ...app1Payload,
  ]);

  // Remove o APP1 Exif anterior, se houver.
  let base: Uint8Array = jpeg;
  let removedEnd = 0;
  let removedStart = 0;
  if (existing) {
    removedStart = existing.start;
    removedEnd = existing.end;
    base = new Uint8Array(jpeg.length - (removedEnd - removedStart));
    base.set(jpeg.slice(0, removedStart), 0);
    base.set(jpeg.slice(removedEnd), removedStart);
  }

  // Insere logo após o SOI e, se existir, depois do APP0 (JFIF).
  const insertionPoint = findJfifEnd(base);
  const out = new Uint8Array(base.length + app1.length);
  out.set(base.slice(0, insertionPoint), 0);
  out.set(app1, insertionPoint);
  out.set(base.slice(insertionPoint), insertionPoint + app1.length);
  return out;
}

function findJfifEnd(jpeg: Uint8Array): number {
  const segments = readSegments(jpeg);
  const jfif = segments.find((segment) => segment.marker === 0xe0);
  return jfif ? jfif.end : 2;
}

// ─── Leitura ───────────────────────────────────────────────────────────────

interface TiffContext {
  base: number;
  littleEndian: boolean;
}

function readUint16(bytes: Uint8Array, offset: number, context: TiffContext): number {
  if (context.littleEndian) return bytes[offset] | (bytes[offset + 1] << 8);
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number, context: TiffContext): number {
  if (context.littleEndian) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>> 0
  );
}

function readRationals(
  bytes: Uint8Array,
  offset: number,
  count: number,
  context: TiffContext,
): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const numerator = readUint32(bytes, offset + index * 8, context);
    const denominator = readUint32(bytes, offset + index * 8 + 4, context);
    values.push(denominator === 0 ? 0 : numerator / denominator);
  }
  return values;
}

function toDecimal(degrees: number, minutes: number, seconds: number): number {
  return degrees + minutes / 60 + seconds / 3600;
}

function readIfdEntries(
  bytes: Uint8Array,
  ifdOffset: number,
  context: TiffContext,
): Array<{ tag: number; type: number; count: number; valueOffset: number; inline: boolean }> {
  const entries: Array<{ tag: number; type: number; count: number; valueOffset: number; inline: boolean }> = [];
  if (ifdOffset + IFD_HEADER_SIZE > bytes.length) return entries;
  const count = readUint16(bytes, ifdOffset, context);
  for (let index = 0; index < count; index += 1) {
    const entryOffset = ifdOffset + IFD_HEADER_SIZE + index * IFD_ENTRY_SIZE;
    if (entryOffset + IFD_ENTRY_SIZE > bytes.length) break;
    const tag = readUint16(bytes, entryOffset, context);
    const type = readUint16(bytes, entryOffset + 2, context);
    const valueCount = readUint32(bytes, entryOffset + 4, context);
    const typeSize = TIFF_TYPE_SIZE[type] ?? 0;
    const totalSize = typeSize * valueCount;
    const inline = totalSize <= 4;
    const valueOffset = inline
      ? entryOffset + 8
      : context.base + readUint32(bytes, entryOffset + 8, context);
    entries.push({ tag, type, count: valueCount, valueOffset, inline });
  }
  return entries;
}

function readEntryAscii(bytes: Uint8Array, entry: { count: number; valueOffset: number; inline: boolean }): string {
  if (entry.inline) return decodeAscii(bytes.slice(entry.valueOffset, entry.valueOffset + entry.count));
  return decodeAscii(bytes.slice(entry.valueOffset, entry.valueOffset + entry.count));
}

function readEntryRationals(
  bytes: Uint8Array,
  entry: { count: number; valueOffset: number },
  context: TiffContext,
): number[] {
  return readRationals(bytes, entry.valueOffset, entry.count, context);
}

/**
 * Lê as coordenadas EXIF GPS de uma imagem JPEG. Retorna null quando a foto
 * não carrega georreferência (por exemplo, imagem vinda da galeria).
 */
export function readExifGeo(jpeg: Uint8Array): ExifGeo | null {
  if (!isJpeg(jpeg)) return null;
  const segment = readSegments(jpeg).find(isExifApp1);
  if (!segment?.payload) return null;

  const tiff = segment.payload.slice(EXIF_HEADER.length);
  if (tiff.length < HEADER_SIZE) return null;

  const byteOrder = String.fromCharCode(tiff[0], tiff[1]);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return null;
  const context: TiffContext = {
    // `tiff` já começa no início do cabeçalho TIFF, então os offsets do
    // formato são relativos a ele — sem base adicional.
    base: 0,
    littleEndian: byteOrder === 'II',
  };

  if (readUint16(tiff, 2, context) !== 42) return null;
  const ifd0Offset = readUint32(tiff, 4, context);
  const ifd0Entries = readIfdEntries(tiff, ifd0Offset, context);
  if (ifd0Entries.length === 0) return null;

  const descriptionEntry = ifd0Entries.find((entry) => entry.tag === TAG_IMAGE_DESCRIPTION);
  const softwareEntry = ifd0Entries.find((entry) => entry.tag === TAG_SOFTWARE);
  const dateTimeEntry = ifd0Entries.find((entry) => entry.tag === TAG_DATE_TIME);
  const gpsPointerEntry = ifd0Entries.find((entry) => entry.tag === TAG_GPS_IFD_POINTER);
  if (!gpsPointerEntry) return null;

  const gpsOffset = readUint32(tiff, gpsPointerEntry.valueOffset, context);
  const gpsEntries = readIfdEntries(tiff, gpsOffset, context);
  if (gpsEntries.length === 0) return null;

  const latitudeEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_LATITUDE);
  const longitudeEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_LONGITUDE);
  if (!latitudeEntry || !longitudeEntry) return null;

  const latitudeRefEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_LATITUDE_REF);
  const longitudeRefEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_LONGITUDE_REF);

  const [latDeg, latMin, latSec] = readEntryRationals(tiff, latitudeEntry, context);
  const [lonDeg, lonMin, lonSec] = readEntryRationals(tiff, longitudeEntry, context);
  const latitudeRef = latitudeRefEntry ? readEntryAscii(tiff, latitudeRefEntry) : 'N';
  const longitudeRef = longitudeRefEntry ? readEntryAscii(tiff, longitudeRefEntry) : 'E';

  let latitude = toDecimal(latDeg, latMin, latSec);
  let longitude = toDecimal(lonDeg, lonMin, lonSec);
  if (latitudeRef.toUpperCase().startsWith('S')) latitude = -latitude;
  if (longitudeRef.toUpperCase().startsWith('W')) longitude = -longitude;

  const altitudeEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_ALTITUDE);
  const altitudeRefEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_ALTITUDE_REF);
  let altitudeMeters: number | null = null;
  if (altitudeEntry) {
    const [value] = readEntryRationals(tiff, altitudeEntry, context);
    const belowSeaLevel = altitudeRefEntry ? tiff[altitudeRefEntry.valueOffset] === 1 : false;
    altitudeMeters = belowSeaLevel ? -value : value;
  }

  const accuracyEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_POSITIONING_ERROR);
  let accuracyMeters: number | null = null;
  if (accuracyEntry) {
    const [value] = readEntryRationals(tiff, accuracyEntry, context);
    accuracyMeters = value;
  }

  const dateStampEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_DATE_STAMP);
  const timeStampEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_TIME_STAMP);
  let capturedAtUtc: string | null = null;
  if (dateStampEntry && timeStampEntry) {
    const dateText = readEntryAscii(tiff, dateStampEntry);
    const [hour, minute, second] = readEntryRationals(tiff, timeStampEntry, context);
    const match = /^(\d{4}):(\d{2}):(\d{2})$/.exec(dateText);
    if (match) {
      capturedAtUtc = `${match[1]}-${match[2]}-${match[3]}T${pad2(Math.floor(hour))}:${pad2(Math.floor(minute))}:${pad2(Math.floor(second))}.000Z`;
    }
  }

  const processingEntry = gpsEntries.find((entry) => entry.tag === GPS_TAG_PROCESSING_METHOD);

  return {
    latitude,
    longitude,
    altitudeMeters,
    accuracyMeters,
    capturedAtUtc,
    dateTimeOriginal: dateTimeEntry ? readEntryAscii(tiff, dateTimeEntry) : null,
    software: softwareEntry ? readEntryAscii(tiff, softwareEntry) : null,
    description: descriptionEntry ? readEntryAscii(tiff, descriptionEntry) : null,
    processingMethod: processingEntry ? readEntryAscii(tiff, processingEntry) : null,
  };
}

// ─── Formatação ────────────────────────────────────────────────────────────

/** Formata coordenada no padrão brasileiro com 6 casas decimais. */
export function formatCoordinate(value: number): string {
  return value.toFixed(6).replace('.', ',');
}

/**
 * Formata a linha de proveniência de uma foto para o laudo em PDF.
 * A saída é texto puro — o estilo fica a cargo de quem renderiza.
 */
export function formatGeoForDocument(geo: ExifGeo | null): string | null {
  if (!geo) return null;
  const parts: string[] = [
    `GPS ${formatCoordinate(geo.latitude)}, ${formatCoordinate(geo.longitude)}`,
  ];
  if (typeof geo.accuracyMeters === 'number' && Number.isFinite(geo.accuracyMeters)) {
    parts.push(`precisão ±${Math.round(geo.accuracyMeters)} m`);
  }
  if (geo.capturedAtUtc) {
    parts.push(formatUtcToBrasilia(geo.capturedAtUtc));
  }
  return parts.join(' · ');
}

/** Converte um instante UTC para o fuso de Brasília (UTC-3, sem horário de verão). */
export function formatUtcToBrasilia(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const p = utcParts(shifted);
  return `${pad2(p.day)}/${pad2(p.month)}/${p.year} ${pad2(p.hour)}:${pad2(p.minute)} (UTC-3)`;
}

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const earthRadius = 6371008.8;
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}
