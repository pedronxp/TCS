import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { purgeLocalTestData, LocalTestPurgeResult } from '../utils/database';
import { logger } from '../utils/logger';

const localDraftPrefix = (uid: string) => `@draft_wizard_test_${uid}_`;

export async function clearLocalTestSessionData(uid: string): Promise<LocalTestPurgeResult> {
  const result = purgeLocalTestData(uid);

  for (const uri of result.fileUris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (error) {
      logger.warn('system', 'Não foi possível apagar um arquivo temporário de teste', {
        uri,
        error: String(error),
      });
    }
  }

  try {
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter(key => key.startsWith(localDraftPrefix(uid)));
    if (draftKeys.length > 0) await AsyncStorage.multiRemove(draftKeys);
  } catch (error) {
    logger.warn('system', 'Não foi possível limpar rascunhos temporários de teste', {
      error: String(error),
    });
  }

  if (result.vistoriaCount > 0 || result.documentCount > 0 || result.eventCount > 0) {
    logger.info('system', 'Sessão de teste anterior descartada', {
      vistorias: result.vistoriaCount,
      documentos: result.documentCount,
      ciencias: result.eventCount,
    });
  }

  return result;
}

export function localTestDraftKey(uid: string, formularioId: string, versao: string): string {
  return `${localDraftPrefix(uid)}${formularioId}_v${versao}`;
}
