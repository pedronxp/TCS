/** Shared wire format keeps scalar legacy answers readable by older clients. */
export const MAX_INSPECTION_PHOTOS = 3;

export function decodePhotoAnswer(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.filter((uri): uri is string => typeof uri === 'string' && Boolean(uri.trim())))];
  if (typeof value !== 'string' || !value.trim()) return [];
  if (value.trim().startsWith('[')) {
    try { return decodePhotoAnswer(JSON.parse(value)); } catch { return []; }
  }
  return [value];
}

export function encodePhotoAnswer(photos: readonly string[]): string {
  const unique = decodePhotoAnswer(photos);
  return unique.length > 1 ? JSON.stringify(unique) : unique[0] ?? '';
}

export function collectInspectionPhotos(answers: readonly unknown[]): string[] {
  return [...new Set(answers.flatMap(decodePhotoAnswer))];
}

export function changePhotoAnswer(current: readonly string[], capturedUri: string | null, replaceIndex?: number, otherPhotos: readonly string[] = []): string[] {
  if (!capturedUri) return [...current];
  const next = [...current];
  if (replaceIndex !== undefined) {
    if (replaceIndex < 0 || replaceIndex >= current.length) throw new Error('Foto não encontrada.');
    next[replaceIndex] = capturedUri;
  } else next.push(capturedUri);
  const unique = decodePhotoAnswer(next);
  if (collectInspectionPhotos([...otherPhotos, ...unique]).length > MAX_INSPECTION_PHOTOS) {
    throw new Error(`Máximo de ${MAX_INSPECTION_PHOTOS} fotos por vistoria.`);
  }
  return unique;
}

/** Synchronous lock: React state alone does not protect against two rapid taps. */
export function createCaptureGate() {
  let busy = false;
  return {
    enter() { if (busy) return false; busy = true; return true; },
    release() { busy = false; },
  };
}
