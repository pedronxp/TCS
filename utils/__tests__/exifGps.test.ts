import {
  buildExifApp1Payload,
  formatGeoForDocument,
  formatUtcToBrasilia,
  haversineMeters,
  injectExifSegment,
  readExifGeo,
} from '../../supabase/functions/_shared/exifGps';

/** JPEG mínimo: SOI + APP0 JFIF + EOI. */
function minimalJpeg(): Uint8Array {
  const jfif = [
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ];
  return new Uint8Array([0xff, 0xd8, ...jfif, 0xff, 0xd9]);
}

describe('exifGps', () => {
  it('grava e lê as coordenadas com precisão de submetro', () => {
    const payload = buildExifApp1Payload({
      latitude: -23.550123,
      longitude: -46.633456,
      altitudeMeters: 760.25,
      accuracyMeters: 8.4,
      capturedAt: '2026-11-10T14:32:11.000Z',
    });
    const jpeg = injectExifSegment(minimalJpeg(), payload);
    const geo = readExifGeo(jpeg);

    expect(geo).not.toBeNull();
    expect(geo!.latitude).toBeCloseTo(-23.550123, 6);
    expect(geo!.longitude).toBeCloseTo(-46.633456, 6);
    expect(geo!.altitudeMeters).toBeCloseTo(760.25, 2);
    expect(geo!.accuracyMeters).toBeCloseTo(8.4, 2);
    expect(geo!.capturedAtUtc).toBe('2026-11-10T14:32:11.000Z');
  });

  it('preserva os bytes da imagem original ao injetar o EXIF', () => {
    const original = minimalJpeg();
    const jpeg = injectExifSegment(
      original,
      buildExifApp1Payload({ latitude: 1, longitude: 2 }),
    );

    expect(jpeg[0]).toBe(0xff);
    expect(jpeg[1]).toBe(0xd8);
    expect(jpeg[jpeg.length - 2]).toBe(0xff);
    expect(jpeg[jpeg.length - 1]).toBe(0xd9);
    // O marcador APP0 JFIF continua no lugar, antes do APP1 de EXIF.
    const app0Index = jpeg.findIndex((_, index) => jpeg[index] === 0xff && jpeg[index + 1] === 0xe0);
    const app1Index = jpeg.findIndex((_, index) => jpeg[index] === 0xff && jpeg[index + 1] === 0xe1);
    expect(app0Index).toBeGreaterThan(-1);
    expect(app1Index).toBeGreaterThan(app0Index);
  });

  it('substitui metadados anteriores em vez de duplicá-los', () => {
    const first = injectExifSegment(
      minimalJpeg(),
      buildExifApp1Payload({ latitude: 10, longitude: 20, capturedAt: '2026-01-01T00:00:00.000Z' }),
    );
    const second = injectExifSegment(
      first,
      buildExifApp1Payload({ latitude: -5, longitude: -6, capturedAt: '2026-02-02T00:00:00.000Z' }),
    );

    const geo = readExifGeo(second);
    expect(geo!.latitude).toBeCloseTo(-5, 6);
    expect(geo!.longitude).toBeCloseTo(-6, 6);

    let app1Count = 0;
    for (let index = 2; index < second.length - 1; index += 1) {
      if (second[index] === 0xff && second[index + 1] === 0xe1) app1Count += 1;
    }
    expect(app1Count).toBe(1);
  });

  it('não finds georreferência em imagem sem EXIF', () => {
    expect(readExifGeo(minimalJpeg())).toBeNull();
  });

  it('recusa coordenadas inválidas', () => {
    expect(() => buildExifApp1Payload({ latitude: 120, longitude: 0 })).toThrow(/Latitude/);
    expect(() => buildExifApp1Payload({ latitude: 0, longitude: 200 })).toThrow(/Longitude/);
    expect(() => buildExifApp1Payload({ latitude: Number.NaN, longitude: 0 })).toThrow(/Coordenadas/);
  });

  it('recusa arquivo que não é JPEG', () => {
    expect(() => injectExifSegment(new Uint8Array([1, 2, 3]), buildExifApp1Payload({ latitude: 0, longitude: 0 })))
      .toThrow(/JPEG/);
  });

  it('formata a proveniência para o laudo', () => {
    const geo = readExifGeo(
      injectExifSegment(
        minimalJpeg(),
        buildExifApp1Payload({
          latitude: -23.550123,
          longitude: -46.633456,
          accuracyMeters: 8.4,
          capturedAt: '2026-11-10T14:32:11.000Z',
        }),
      ),
    );

    expect(formatGeoForDocument(geo)).toBe(
      'GPS -23,550123, -46,633456 · precisão ±8 m · 10/11/2026 11:32 (UTC-3)',
    );
    expect(formatGeoForDocument(null)).toBeNull();
  });

  it('converte UTC para o fuso de Brasília', () => {
    expect(formatUtcToBrasilia('2026-11-10T14:32:11.000Z')).toBe('10/11/2026 11:32 (UTC-3)');
  });

  it('calcula distância entre pontos', () => {
    // São Paulo → Santos, cerca de 70 km.
    const distance = haversineMeters(
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.9608, longitude: -46.3336 },
    );
    expect(distance).toBeGreaterThan(40000);
    expect(distance).toBeLessThan(80000);
    expect(haversineMeters({ latitude: -23.55, longitude: -46.63 }, { latitude: -23.55, longitude: -46.63 }))
      .toBeCloseTo(0, 6);
  });
});
