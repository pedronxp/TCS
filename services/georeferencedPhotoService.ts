/**
 * services/georeferencedPhotoService.ts
 *
 * Captura de foto com georreferência embutida no próprio arquivo.
 *
 * Contexto: o TCS não tem convênio com a Defesa Civil. Uma foto comum não
 * prova onde nem quando foi registrada — e sem essa prova, o laudo técnico
 * fica sem sustentação verificável fora do sistema. Por isso a georreferência
 * viaja DENTRO do JPEG (tags EXIF GPS), e não em colunas do banco: qualquer
 * auditor com `exiftool` confere a coordenada e o instante sem depender do
 * TCS, do banco de dados ou da rede.
 *
 * Ordem obrigatória das etapas:
 *   1. obtém a posição do GPS no instante do disparo;
 *   2. comprime e grava o JPEG em disco — o ImageManipulator reescreve o
 *      arquivo e descarta o EXIF original;
 *   3. compõe o carimbo visual (endereço quando disponível, GPS e instante)
 *      e persiste o JPEG resultante;
 *   4. só então grava o EXIF GPS no arquivo final;
 *   5. calcula o SHA-256 do arquivo gravado.
 *
 * Uma foto vinda da galeria pode ter sido tirada em outro lugar: o GPS do
 * aparelho descreve onde o AGENTE está, não onde a foto foi tirada. Nesse
 * caso só vale o EXIF original — usar o GPS atual produziria prova falsa.
 */

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { File } from 'expo-file-system';
import {
  buildExifApp1Payload,
  injectExifSegment,
  readExifGeo,
  ExifGeo,
} from '../supabase/functions/_shared/exifGps';
import { sha256Bytes } from '../utils/documentIntegrity';
import { compressAndPersistImage, EVIDENCE_IMAGE_MAX_WIDTH } from '../utils/imageCompression';
import { logger } from '../utils/logger';
import { aplicarCarimboFoto, criarCarimboFoto } from './photoStampService';

/** Idade máxima aceitável para a "última posição conhecida" do GPS. */
const IDADE_MAXIMA_ULTIMA_POSICAO_MS = 15 * 60 * 1000;

/** Tempo limite para obter uma posição nova do GPS. */
const TIMEOUT_GPS_MS = 15000;

/**
 * Acima desta precisão o ponto é registrado, mas marcado como impreciso —
 * serve para orientar a vistoria, não para provar o local com exatidão.
 */
export const PRECISAO_IMPRECISA_M = 50;

export type OrigemFoto = 'camera' | 'galeria';

export interface PosicaoGps {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
}

export interface GeorreferenciaFoto {
  /** Aviso explícito quando foi preciso preservar a foto sem carimbo visual. */
  avisoCarimbo?: string;
  /** URI local do arquivo final (já com EXIF GPS gravado). */
  uri: string;
  /** SHA-256 do arquivo final — verificação de integridade. */
  hash: string;
  /** Tamanho do arquivo final em bytes. */
  byteSize: number;
  /** Metadados georreferenciados lidos de volta do arquivo gravado. */
  geo: ExifGeo | null;
  /** De onde veio a coordenada: GPS do aparelho ou EXIF original. */
  origem: OrigemFoto;
  /** true quando não foi possível obter coordenada alguma. */
  semGeorreferencia: boolean;
}

export interface ResultadoCaptura {
  /** true quando o usuário cancelou a captura. */
  cancelado: boolean;
  foto?: GeorreferenciaFoto;
}

// ─── Normalização de coordenadas ───────────────────────────────────────────

function normalizeLatitude(value: number): number | null {
  return Number.isFinite(value) && value >= -90 && value <= 90 ? value : null;
}

function normalizeLongitude(value: number): number | null {
  return Number.isFinite(value) && value >= -180 && value <= 180 ? value : null;
}

function normalizeAccuracy(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeAltitude(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Converte o EXIF GPS em uma posição utilizável. */
function exifParaPosicao(geo: ExifGeo | null): PosicaoGps | null {
  if (!geo) return null;
  const latitude = normalizeLatitude(geo.latitude);
  const longitude = normalizeLongitude(geo.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    accuracy: normalizeAccuracy(geo.accuracyMeters),
    altitude: normalizeAltitude(geo.altitudeMeters),
  };
}

// ─── Leitura de arquivo ────────────────────────────────────────────────────

/**
 * Lê as tags GPS do EXIF de um arquivo já presente no disco.
 * Retorna null quando o arquivo não tem EXIF GPS utilizável.
 */
export async function lerGeorreferenciaDoArquivo(uri: string): Promise<ExifGeo | null> {
  try {
    const file = new File(uri);
    if (!file.exists) return null;
    const bytes = await file.bytes();
    return readExifGeo(bytes);
  } catch (e) {
    logger.warn('storage', 'Falha ao ler EXIF GPS do arquivo', { erro: String(e) });
    return null;
  }
}

// ─── GPS ───────────────────────────────────────────────────────────────────

/**
 * Obtém a posição atual do GPS do aparelho.
 *
 * Nunca lança: em caso de falha, devolve null e o chamador registra a foto
 * sem coordenada. Uma posição antiga demais é descartada — apontar o local
 * errado é pior que apontar nenhum.
 */
export async function obterPosicaoAtual(): Promise<PosicaoGps | null> {
  try {
    // O temporizador é limpo em qualquer desfecho: deixá-lo pendente mantém
    // o event loop vivo por até 15 s depois de cada leitura de GPS.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('GPS timeout')), TIMEOUT_GPS_MS);
    });
    let loc: Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>;
    try {
      loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        timeout,
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    const latitude = normalizeLatitude(loc.coords.latitude);
    const longitude = normalizeLongitude(loc.coords.longitude);
    if (latitude === null || longitude === null) return null;
    return {
      latitude,
      longitude,
      accuracy: normalizeAccuracy(loc.coords.accuracy),
      altitude: normalizeAltitude(loc.coords.altitude),
    };
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (!last || Date.now() - last.timestamp > IDADE_MAXIMA_ULTIMA_POSICAO_MS) return null;
      const latitude = normalizeLatitude(last.coords.latitude);
      const longitude = normalizeLongitude(last.coords.longitude);
      if (latitude === null || longitude === null) return null;
      return {
        latitude,
        longitude,
        accuracy: normalizeAccuracy(last.coords.accuracy),
        altitude: normalizeAltitude(last.coords.altitude),
      };
    } catch {
      return null;
    }
  }
}

async function pedirPermissaoLocalizacao(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Gravação ──────────────────────────────────────────────────────────────

/**
 * Grava a georreferência no arquivo e devolve os metadados lidos de volta.
 *
 * Se a gravação falhar, o arquivo original é preservado: a foto não pode ser
 * perdida por causa de metadado.
 */
async function gravarGeorreferencia(
  uri: string,
  posicao: PosicaoGps | null,
  capturedAt: Date,
): Promise<{ geo: ExifGeo | null; hash: string; byteSize: number }> {
  const file = new File(uri);
  const bytes = await file.bytes();

  if (posicao) {
    try {
      const payload = buildExifApp1Payload({
        latitude: posicao.latitude,
        longitude: posicao.longitude,
        altitudeMeters: posicao.altitude,
        accuracyMeters: posicao.accuracy,
        capturedAt,
        software: 'TCS',
        description: JSON.stringify({
          origem: 'tcs',
          registradoEm: capturedAt.toISOString(),
          precisaoM: posicao.accuracy,
        }),
      });
      const atualizado = injectExifSegment(bytes, payload);
      // SDK 58: `File.write()` virou assíncrono — sem `await` o arquivo
      // poderia ser lido antes de o EXIF ser gravado.
      await file.write(atualizado);
      return {
        geo: readExifGeo(atualizado),
        hash: await sha256Bytes(atualizado),
        byteSize: atualizado.byteLength,
      };
    } catch (e) {
      logger.warn('storage', 'Falha ao gravar EXIF GPS; foto mantida sem metadado', {
        erro: String(e),
      });
    }
  }

  return {
    geo: readExifGeo(bytes),
    hash: await sha256Bytes(bytes),
    byteSize: bytes.byteLength,
  };
}

// ─── Captura ───────────────────────────────────────────────────────────────

/** Solicita as permissões de câmera; devolve false quando o usuário nega. */
export async function solicitarPermissaoCamera(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

interface OpcoesCompressao {
  directoryName?: string;
  filePrefix?: string;
  maxWidth?: number;
}

/**
 * Captura uma foto pela câmera e a grava com georreferência.
 *
 * A posição do GPS é lida logo após o disparo, antes da compressão — assim a
 * coordenada descreve o instante da foto, não o do término do processamento.
 */
export async function capturarFotoGeorreferenciada(
  opcoes: OpcoesCompressao = {},
): Promise<ResultadoCaptura> {
  const permitted = await solicitarPermissaoCamera();
  if (!permitted) {
    return { cancelado: true };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) {
    return { cancelado: true };
  }

  const capturedAt = new Date();

  // O EXIF original da câmera é lido ANTES da compressão: o ImageManipulator
  // reescreve o arquivo e descarta os metadados originais.
  const exifOriginal = exifParaPosicao(await lerGeorreferenciaDoArquivo(result.assets[0].uri));

  // GPS do aparelho no instante do disparo.
  const permissaoLocalizacao = await pedirPermissaoLocalizacao();
  const posicaoGps = permissaoLocalizacao ? await obterPosicaoAtual() : null;

  let uriPersistida = await compressAndPersistImage(result.assets[0].uri, {
    directoryName: opcoes.directoryName ?? 'fotos/evidencias',
    filePrefix: opcoes.filePrefix ?? 'evidencia',
    maxWidth: opcoes.maxWidth ?? EVIDENCE_IMAGE_MAX_WIDTH,
  });

  // O GPS do aparelho tem precedência: ele é a posição real do agente.
  // O EXIF original só entra quando não houve fixo novo.
  const posicao = posicaoGps ?? exifOriginal;
  const originalPersistida = uriPersistida;

  let avisoCarimbo: string | undefined;
  try {
    const carimbo = await criarCarimboFoto(posicao, capturedAt);
    const temporaria = await aplicarCarimboFoto({ uri: uriPersistida, carimbo });
    // A composição gera outro JPEG: EXIF e hash pertencem ao arquivo FINAL.
    uriPersistida = await compressAndPersistImage(temporaria, {
      directoryName: opcoes.directoryName ?? 'fotos/evidencias',
      filePrefix: opcoes.filePrefix ?? 'evidencia',
      maxWidth: opcoes.maxWidth ?? EVIDENCE_IMAGE_MAX_WIDTH,
    });
    if (uriPersistida === temporaria && temporaria !== originalPersistida) {
      throw new Error('Não foi possível persistir o JPEG carimbado.');
    }
    if (temporaria !== uriPersistida) {
      try { await new File(temporaria).delete(); } catch { /* limpeza temporária */ }
    }
  } catch (error) {
    uriPersistida = originalPersistida;
    avisoCarimbo = 'A foto foi preservada, mas não foi possível gravar a localização visível. Tire outra foto para tentar novamente.';
    logger.warn('storage', 'Foto preservada sem carimbo visual', { erro: String(error) });
  }

  const { geo, hash, byteSize } = await gravarGeorreferencia(uriPersistida, posicao, capturedAt);
  // A cópia intermediária só é removida depois que o arquivo final foi lido.
  // Nunca apagar a URI retornada pela câmera em um fallback de persistência.
  if (uriPersistida !== originalPersistida && originalPersistida !== result.assets[0].uri) {
    try { await new File(originalPersistida).delete(); } catch { /* limpeza intermediária */ }
  }

  return {
    cancelado: false,
    foto: {
      uri: uriPersistida,
      hash,
      byteSize,
      geo,
      origem: 'camera',
      semGeorreferencia: !geo,
      avisoCarimbo,
    },
  };
}

/**
 * Registra a georreferência de uma foto vinda da galeria.
 *
 * Só o EXIF original vale: o GPS do aparelho descreve onde o agente está,
 * não onde a foto foi tirada. Sem EXIF GPS, a foto fica registrada como sem
 * georreferência — é melhor do que anexar uma coordenada falsa.
 */
export async function registrarGeorreferenciaDaGaleria(
  uriOrigem: string,
  opcoes: OpcoesCompressao = {},
): Promise<GeorreferenciaFoto> {
  const uriPersistida = await compressAndPersistImage(uriOrigem, {
    directoryName: opcoes.directoryName ?? 'fotos/evidencias',
    filePrefix: opcoes.filePrefix ?? 'evidencia',
    maxWidth: opcoes.maxWidth ?? EVIDENCE_IMAGE_MAX_WIDTH,
  });

  // A compressão descarta o EXIF: a coordenada precisa ser lida ANTES dela.
  const exifOrigem = exifParaPosicao(await lerGeorreferenciaDoArquivo(uriOrigem));

  if (!exifOrigem) {
    const bytes = await new File(uriPersistida).bytes();
    return {
      uri: uriPersistida,
      hash: await sha256Bytes(bytes),
      byteSize: bytes.byteLength,
      geo: readExifGeo(bytes),
      origem: 'galeria',
      semGeorreferencia: true,
    };
  }

  const { geo, hash, byteSize } = await gravarGeorreferencia(
    uriPersistida,
    exifOrigem,
    new Date(),
  );
  return {
    uri: uriPersistida,
    hash,
    byteSize,
    geo,
    origem: 'galeria',
    semGeorreferencia: !geo,
  };
}
