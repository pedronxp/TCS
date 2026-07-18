import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {
  DocumentContentSnapshot,
  GeneratedDocumentType,
  SignatureStroke,
} from '../types/documentAcknowledgement';

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | {
  [key: string]: CanonicalValue;
};

function normalizeCanonical(value: unknown, seen: Set<object>): CanonicalValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error('Snapshot circular não pode ser canonicalizado');
    seen.add(value);
    const normalized = value.map(item =>
      item === undefined ? null : normalizeCanonical(item, seen)
    );
    seen.delete(value);
    return normalized;
  }
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (seen.has(objectValue)) throw new Error('Snapshot circular não pode ser canonicalizado');
    seen.add(objectValue);
    const normalized: Record<string, CanonicalValue> = {};
    Object.keys(objectValue)
      .filter(key => objectValue[key] !== undefined)
      .sort()
      .forEach(key => {
        const item = objectValue[key];
        if (typeof item !== 'function' && typeof item !== 'symbol') {
          normalized[key] = normalizeCanonical(item, seen);
        }
      });
    seen.delete(objectValue);
    return normalized;
  }
  return null;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value, new Set<object>()));
}

export async function sha256String(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  // No iOS/Expo Go, o bridge nativo de expo-crypto exige explicitamente um
  // TypedArray. Passar o ArrayBuffer subjacente causa ArgumentCastException.
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256File(uri: string): Promise<{ hash: string; byteSize: number }> {
  const file = new File(uri);
  if (!file.exists) throw new Error('Arquivo do documento não foi encontrado');
  const bytes = await file.bytes();
  return { hash: await sha256Bytes(bytes), byteSize: bytes.byteLength };
}

export async function hashCanonical(value: unknown): Promise<string> {
  return sha256String(canonicalize(value));
}

export function createDocumentSnapshot<TPayload extends object>(
  documentType: GeneratedDocumentType,
  templateVersion: string,
  vistoriaId: string,
  trainingMode: boolean,
  payload: TPayload
): DocumentContentSnapshot<TPayload> {
  return {
    documentType,
    templateVersion,
    vistoriaId,
    trainingMode,
    payload,
  };
}

export function normalizeSignatureStrokes(strokes: SignatureStroke[]): SignatureStroke[] {
  if (!Array.isArray(strokes) || strokes.length > 80) {
    throw new Error('Assinatura inválida');
  }
  return strokes.map(stroke => {
    if (!Array.isArray(stroke.points) || stroke.points.length > 2000) {
      throw new Error('Assinatura inválida');
    }
    return {
      points: stroke.points.map(point => {
        const x = Number(point.x);
        const y = Number(point.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error('Assinatura contém coordenadas inválidas');
        }
        return {
          x: Math.round(Math.max(0, Math.min(1, x)) * 10000) / 10000,
          y: Math.round(Math.max(0, Math.min(1, y)) * 10000) / 10000,
        };
      }),
    };
  });
}

export function hasMinimumSignature(strokes: SignatureStroke[]): boolean {
  const normalized = normalizeSignatureStrokes(strokes);
  const points = normalized.flatMap(stroke => stroke.points);
  if (points.length < 8) return false;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return Math.max(...xs) - Math.min(...xs) >= 0.08
    && Math.max(...ys) - Math.min(...ys) >= 0.04;
}
