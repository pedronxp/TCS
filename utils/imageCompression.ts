import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { logger } from './logger';

export const DEFAULT_IMAGE_QUALITY = 0.72;
export const DEFAULT_IMAGE_MAX_WIDTH = 1280;
export const EVIDENCE_IMAGE_MAX_WIDTH = 854;

type CompressAndPersistImageOptions = {
  directoryName?: string;
  filePrefix?: string;
  maxWidth?: number;
  quality?: number;
};

function uniqueJpegName(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${suffix}.jpg`;
}

async function getImageWidth(uri: string): Promise<number | null> {
  return new Promise(resolve => {
    Image.getSize(
      uri,
      width => resolve(width),
      () => resolve(null),
    );
  });
}

async function copyToPersistentFile(sourceUri: string, targetUri: string): Promise<string> {
  await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
  return targetUri;
}

async function deleteCacheFile(uri: string): Promise<void> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir || !uri.startsWith(cacheDir)) return;

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Cache cleanup is best effort only.
  }
}

export async function compressAndPersistImage(
  uri: string,
  options: CompressAndPersistImageOptions = {},
): Promise<string> {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) return uri;

  const directoryName = options.directoryName ?? 'fotos';
  const directory = `${documentDirectory}${directoryName.replace(/^\/+|\/+$/g, '')}/`;
  const targetUri = `${directory}${uniqueJpegName(options.filePrefix ?? 'foto')}`;
  const maxWidth = options.maxWidth ?? DEFAULT_IMAGE_MAX_WIDTH;
  const quality = options.quality ?? DEFAULT_IMAGE_QUALITY;

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  try {
    const width = await getImageWidth(uri);
    const actions: Parameters<typeof ImageManipulator.manipulateAsync>[1] =
      width && width > maxWidth ? [{ resize: { width: maxWidth } }] : [];
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    );

    const persistentUri = await copyToPersistentFile(compressed.uri, targetUri);
    await deleteCacheFile(compressed.uri);
    return persistentUri;
  } catch (error: any) {
    logger.warn('storage', 'Falha ao comprimir imagem; salvando arquivo original.', {
      uri,
      message: error?.message || String(error),
    });

    try {
      return await copyToPersistentFile(uri, targetUri);
    } catch (copyError: any) {
      logger.warn('storage', 'Falha ao persistir imagem original; usando URI de origem.', {
        uri,
        message: copyError?.message || String(copyError),
      });
      return uri;
    }
  }
}
