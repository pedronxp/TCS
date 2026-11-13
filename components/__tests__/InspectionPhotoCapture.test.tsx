import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import FotoScreen from '../../app/(panel)/inspecoes/foto';
import { uploadImageFromLocalUri } from '../../services/StorageService';
import { capturarFotoGeorreferenciada } from '../../services/georeferencedPhotoService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../utils/supabase';
import { saveRemoteInspectionPhotoDraft } from '../../services/RemoteInspectionPhotoDraftService';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'inspection-1' }) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ profile: { uid: 'user-1' } }) }));
jest.mock('../../context/ConnectivityContext', () => ({ useConnectivity: () => ({ isOnlineReal: true }) }));
jest.mock('../../utils/database', () => ({
  getVistoriaById: () => ({ id: 'inspection-1', agente_uid: 'user-1', foto_url: null, fotos_urls: null }),
  isTrainingVistoria: () => false, updateVistoriaMedia: jest.fn(),
}));
jest.mock('../../services/SyncService', () => ({ syncPendentes: jest.fn(async () => ({})) }));
jest.mock('../../services/StorageService', () => ({
  decodePath: (uri: string) => uri.startsWith('fotos:') ? { bucket: 'fotos', remotePath: uri.slice(6) } : null, getSignedUrl: jest.fn(async (uri: string) => uri),
  uploadImageFromLocalUri: jest.fn(async () => 'fotos:uploaded.jpg'),
}));
jest.mock('../../services/georeferencedPhotoService', () => ({
  solicitarPermissaoCamera: jest.fn(async () => true),
  capturarFotoGeorreferenciada: jest.fn(async () => ({ cancelado: false, foto: { uri: 'file://captured.jpg' } })),
  lerGeorreferenciaDoArquivo: jest.fn(async () => null), registrarGeorreferenciaDaGaleria: jest.fn(),
}));
jest.mock('../../utils/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } })) },
  rpc: jest.fn(async () => ({ data: null, error: null })),
  from: jest.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { fotosUrls: [] } }) }) }) })),
} }));
jest.mock('../../utils/navigationUtils', () => ({ safeBack: jest.fn() }));
jest.mock('../ui', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    AppHeader: () => <View />, EmptyState: () => <View />, SectionHeader: () => <View />, StateBanner: () => <View />,
    Button: ({ label, onPress, disabled }: any) => <TouchableOpacity onPress={onPress} disabled={disabled}><Text>{label}</Text></TouchableOpacity>,
  };
});
jest.setTimeout(15000);
beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

it('authorizes a newly captured upload with the actual inspection id rather than a generated storage path', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<FotoScreen />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Adicionar foto'));
  const buttons = alert.mock.calls.find(([title]) => title === 'Adicionar Foto')?.[2];
  const camera = buttons?.find(button => button.text === 'Câmera');
  await act(async () => { await camera?.onPress?.(); });
  expect(uploadImageFromLocalUri).toHaveBeenCalledWith('file://captured.jpg', 'inspection-1');
  (capturarFotoGeorreferenciada as jest.Mock).mockResolvedValueOnce({ cancelado: true });
  await act(async () => { fireEvent.press(screen.getByLabelText('Substituir foto 1')); });
  expect(screen.getByLabelText('Visualizar foto 1')).toBeTruthy();
  expect(uploadImageFromLocalUri).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

it('blocks a reopened draft based on revision 10 when another device has already published revision 11', async () => {
  await saveRemoteInspectionPhotoDraft('user-1', 'inspection-1', ['file://old.jpg'], 20, 10);
  (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: { revision: 11 }, error: null });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<FotoScreen />);
  await act(async () => {});
  await act(async () => { fireEvent.press(screen.getByText(/Salvar 1 evidência/)); });
  expect((supabase.rpc as jest.Mock).mock.calls.filter(([name]) => name === 'update_inspection_media')).toHaveLength(0);
  expect(uploadImageFromLocalUri).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@inspection_photo_draft:user-1:inspection-1')).toContain('"baseRevision":10');
  alert.mockRestore();
});

it('preserves two unavailable remote slots when replacing the one available image', async () => {
  const manifest = { version: 1, revision: 10, expected: 3, available: 1, items: [
    { id: 'a', position: 0, state: 'available', storagePath: 'fotos:a' },
    { id: 'b', position: 1, state: 'pending', storagePath: null },
    { id: 'c', position: 2, state: 'pending', storagePath: null },
  ] };
  (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: { revision: 10 }, error: null });
  (supabase.from as jest.Mock).mockImplementationOnce(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { fotoUrl: 'fotos:a', fotosUrls: [], media_manifest: manifest } }) }) }) }));
  render(<FotoScreen />);
  await act(async () => {});
  await act(async () => { fireEvent.press(screen.getByLabelText('Substituir foto 1')); });
  await act(async () => { fireEvent.press(screen.getByText(/Salvar 1 evidência/)); });
  const published = (supabase.rpc as jest.Mock).mock.calls.find(([name]) => name === 'update_inspection_media')?.[1];
  expect(published.p_media_manifest).toMatchObject({ expected: 3, available: 1, base_revision: 10 });
  expect(published.p_media_manifest.items.filter((item: { state: string }) => item.state === 'pending').map((item: { id: string }) => item.id)).toEqual(['b', 'c']);
});
