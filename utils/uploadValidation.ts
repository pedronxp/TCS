/**
 * Utilitários de Validação de Upload
 *
 * Validações para upload seguro de imagens
 */

// Tamanho máximo: 10MB
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Tipos MIME permitidos
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida se o arquivo é uma imagem válida
 */
export async function validateImageFile(uri: string): Promise<ValidationResult> {
  try {
    // Verificar se o URI existe
    if (!uri || uri.trim() === '') {
      return { valid: false, error: 'URI da imagem inválida' };
    }

    // Para URIs locais do React Native
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
      // Validação básica - o ImagePicker já faz validação de tipo
      return { valid: true };
    }

    // Para URIs HTTP/HTTPS (fotos já sincronizadas)
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return { valid: true };
    }

    return { valid: false, error: 'Formato de URI não suportado' };
  } catch (error) {
    return { valid: false, error: 'Erro ao validar imagem' };
  }
}

/**
 * Retry com backoff exponencial
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Valida tamanho do arquivo
 * Nota: React Native não fornece tamanho diretamente do ImagePicker,
 * então esta é uma validação aproximada baseada nas dimensões
 */
export function estimateImageSize(width: number, height: number, quality: number = 0.8): number {
  // Estimativa: ~3 bytes por pixel para JPEG com qualidade 0.8
  const bytesPerPixel = 3 * quality;
  return width * height * bytesPerPixel;
}

/**
 * Valida se a imagem excede o tamanho máximo (estimativa)
 */
export function isImageTooLarge(width: number, height: number): boolean {
  const estimatedSize = estimateImageSize(width, height);
  return estimatedSize > MAX_FILE_SIZE_BYTES;
}

/**
 * Calcula dimensões otimizadas mantendo aspect ratio
 */
export function calculateOptimizedDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;

  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Sanitiza nome de arquivo
 */
export function sanitizeFileName(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Gera nome de arquivo único
 */
export function generateUniqueFileName(prefix: string = 'img'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${sanitizeFileName(prefix)}_${timestamp}_${random}.jpg`;
}

/**
 * Valida caminho de storage para prevenir path traversal
 */
export function validateStoragePath(path: string): ValidationResult {
  // Prevenir path traversal
  if (path.includes('..') || path.includes('//')) {
    return { valid: false, error: 'Caminho inválido detectado' };
  }

  // Verificar caracteres permitidos
  if (!/^[a-zA-Z0-9/_.-]+$/.test(path)) {
    return { valid: false, error: 'Caminho contém caracteres não permitidos' };
  }

  // Verificar comprimento máximo
  if (path.length > 512) {
    return { valid: false, error: 'Caminho muito longo' };
  }

  return { valid: true };
}
