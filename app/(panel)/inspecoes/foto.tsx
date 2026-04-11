import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Alert, Modal, Pressable, Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../../../context/ThemeContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { updateFotosUrls, getVistoriaById } from '../../../utils/database';
import { EmptyState, Button } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fixedFooterBottomPadding, fixedFooterScrollPadding } from '../../../utils/useBottomTabPadding';
const MAX_FOTOS = 3;
const QUALIDADE = 0.72;   // 72% JPEG — spec AGENTS.md
const LARGURA_MAX = 854;  // 480p landscape — spec AGENTS.md

interface FotoItem {
  localId: string;       // identificador único para rastrear updates sem depender de índice
  uri: string;
  uploading?: boolean;
  url?: string;
  erro?: boolean;
}

export default function FotoScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  // useLocalSearchParams pode retornar string ou string[] — normalizar para string
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOnlineReal } = useConnectivity();
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // Tentar SQLite primeiro
    const local = getVistoriaById(id as string);
    if (local?.fotos_urls) {
      try {
        const urls: string[] = JSON.parse(local.fotos_urls);
        if (urls.length > 0) {
          setFotos(urls.map(uri => ({
            localId: uri,
            uri,
            url: uri.startsWith('http') ? uri : undefined,
          })));
          return;
        }
      } catch { /* noop */ }
    }

    // Fallback: buscar fotosUrls do Supabase (vistorias já sincronizadas)
    (async () => {
      try {
        const { data } = await supabase
          .from('vistorias')
          .select('fotosUrls')
          .eq('id', id as string)
          .single();
        const urls: string[] = data?.fotosUrls ?? [];
        if (urls.length > 0) {
          setFotos(urls.map(uri => ({
            localId: uri,
            uri,
            url: uri.startsWith('http') ? uri : undefined,
          })));
        }
      } catch { /* sem fotos remotas */ }
    })();
  }, [id]);

  const solicitarPermissaoCamera = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'O app precisa de acesso à câmera para registrar evidências fotográficas.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const comprimirImagem = async (uri: string): Promise<string> => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: LARGURA_MAX } }],
      { compress: QUALIDADE, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  };

  const processarFoto = async (uri: string) => {
    if (fotos.length >= MAX_FOTOS) return;

    // Usar localId único para rastrear o item sem depender de índice por closure
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFotos(prev => [...prev, { localId, uri, uploading: true }]);

    try {
      const uriComprimida = await comprimirImagem(uri);

      // Só tenta upload se tiver internet real
      if (isOnlineReal) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const fileName = `vistorias/${id || 'sem-id'}/${Date.now()}.jpg`;
            const response = await fetch(uriComprimida);
            const blob = await response.blob();

            const { data: uploadData } = await supabase.storage
              .from('fotos')
              .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

            if (uploadData) {
              const { data: { publicUrl } } = supabase.storage
                .from('fotos')
                .getPublicUrl(uploadData.path);

              setFotos(prev => prev.map(f =>
                f.localId === localId
                  ? { localId, uri: uriComprimida, url: publicUrl, uploading: false }
                  : f
              ));
              return;
            }
          }
        } catch {
          // Upload falhou — cai para salvar localmente
        }
      }

      // Offline ou upload falhou — salvar só URI local
      setFotos(prev => prev.map(f =>
        f.localId === localId
          ? { localId, uri: uriComprimida, uploading: false }
          : f
      ));
    } catch (e) {
      setFotos(prev => prev.map(f =>
        f.localId === localId ? { ...f, uploading: false, erro: true } : f
      ));
    }
  };

  const tirarFoto = async () => {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS} fotos por vistoria.`);
      return;
    }
    const ok = await solicitarPermissaoCamera();
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await processarFoto(result.assets[0].uri);
  };

  const escolherDaGaleria = async () => {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS} fotos por vistoria.`);
      return;
    }
    const disponivel = MAX_FOTOS - fotos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: disponivel,
    });

    if (result.canceled || !result.assets?.length) return;
    // Processar cada foto selecionada em sequência
    for (const asset of result.assets) {
      await processarFoto(asset.uri);
    }
  };

  const tentarNovamente = async (localId: string) => {
    const foto = fotos.find(f => f.localId === localId);
    if (!foto) return;

    setFotos(prev => prev.map(f =>
      f.localId === localId ? { ...f, erro: false, uploading: true } : f
    ));

    try {
      if (isOnlineReal) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const fileName = `vistorias/${id || 'sem-id'}/${Date.now()}.jpg`;
          const response = await fetch(foto.uri);
          const blob = await response.blob();
          const { data: uploadData } = await supabase.storage
            .from('fotos')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
          if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('fotos').getPublicUrl(uploadData.path);
            setFotos(prev => prev.map(f =>
              f.localId === localId
                ? { ...f, url: publicUrl, uploading: false, erro: false }
                : f
            ));
            return;
          }
        }
      }
      // Sem internet — mantém local sem erro
      setFotos(prev => prev.map(f =>
        f.localId === localId ? { ...f, uploading: false, erro: false } : f
      ));
    } catch {
      setFotos(prev => prev.map(f =>
        f.localId === localId ? { ...f, uploading: false, erro: true } : f
      ));
    }
  };

  const removerFoto = (localId: string) => {
    Alert.alert('Remover foto?', 'Esta foto será excluída permanentemente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: () => setFotos(prev => prev.filter(f => f.localId !== localId)),
      },
    ]);
  };

  const salvarEvidencias = async () => {
    if (fotos.some(f => f.uploading)) {
      Alert.alert('Aguarde', 'Ainda há fotos sendo processadas.');
      return;
    }
    setSalvando(true);
    try {
      // Se online, tentar re-upload de fotos locais que ainda não foram sincronizadas
      let fotosAtualizadas = [...fotos];
      if (isOnlineReal) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const pendentes = fotosAtualizadas.filter(f => !f.url && !f.erro);
          for (const foto of pendentes) {
            try {
              const fileName = `vistorias/${id || 'sem-id'}/${Date.now()}.jpg`;
              const response = await fetch(foto.uri);
              const blob = await response.blob();
              const { data: uploadData } = await supabase.storage
                .from('fotos')
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
              if (uploadData) {
                const { data: { publicUrl } } = supabase.storage
                  .from('fotos')
                  .getPublicUrl(uploadData.path);
                fotosAtualizadas = fotosAtualizadas.map(f =>
                  f.localId === foto.localId ? { ...f, url: publicUrl } : f
                );
              }
            } catch {
              // Não bloqueia — foto fica como local
            }
          }
          // Atualizar estado com as novas URLs sincronizadas
          setFotos(fotosAtualizadas);
        }
      }

      const allUris = fotosAtualizadas.map(f => f.url ?? f.uri);

      // Salvar no SQLite local (todas as uris, online ou não)
      if (id) {
        updateFotosUrls(id, allUris);
      }

      // Salvar URLs no Supabase (incluindo quando todas são removidas — limpar o campo)
      const remoteUrls = fotosAtualizadas.filter(f => f.url).map(f => f.url!);
      if (id && isOnlineReal) {
        await supabase
          .from('vistorias')
          .update({ fotosUrls: remoteUrls.length > 0 ? remoteUrls : null })
          .eq('id', id);
      }

      router.back();
    } catch {
      router.back();
    } finally {
      setSalvando(false);
    }
  };

  const mostrarOpcoes = () => {
    Alert.alert('Adicionar Foto', 'Como deseja adicionar a foto?', [
      { text: 'Câmera', onPress: tirarFoto },
      { text: 'Galeria', onPress: escolherDaGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: theme.text }]}>Evidências</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Vistoria #{id?.toString().slice(0, 6)} · {fotos.length}/{MAX_FOTOS} fotos
            {!isOnlineReal && ' · offline'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: fixedFooterScrollPadding(insets) }]}>
        <Text style={[styles.instruction, { color: theme.textSecondary }]}>
          Registre evidências fotográficas da edificação, pontos críticos e irregularidades estruturais.
          {'\n'}Fotos comprimidas em JPEG 72% / 480p para otimização de armazenamento.
        </Text>

        {fotos.length === 0 && (
          <EmptyState
            icon="camera"
            title="Nenhuma foto registrada"
            description="Tire uma foto para documentar a vistoria."
            actionLabel="Tirar Foto"
            onAction={tirarFoto}
            style={{ flex: 0, paddingVertical: 40 }}
          />
        )}

        <View style={styles.grid}>
          {fotos.map((foto) => (
            <TouchableOpacity
              key={foto.localId}
              style={[styles.fotoWrapper, { borderColor: foto.erro ? '#EF4444' : theme.border }]}
              onPress={() => !foto.uploading && !foto.erro && setFotoAmpliada(foto.uri)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: foto.uri }} style={styles.foto} />

              {foto.uploading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.uploadText}>Processando...</Text>
                </View>
              )}

              {foto.erro && (
                <>
                  <View style={styles.erroOverlay}>
                    <Feather name="alert-circle" size={20} color="#FFF" />
                    <Text style={styles.erroText}>Falha no upload</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => tentarNovamente(foto.localId)}>
                      <Feather name="refresh-cw" size={12} color="#EF4444" />
                      <Text style={styles.retryText}>Tentar novamente</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {foto.url && !foto.erro && (
                <View style={styles.syncBadge}>
                  <Feather name="cloud" size={12} color="#FFF" />
                </View>
              )}

              {!foto.url && !foto.uploading && !foto.erro && (
                <View style={styles.localBadge}>
                  <Feather name="smartphone" size={12} color="#FFF" />
                </View>
              )}

              {!foto.uploading && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => removerFoto(foto.localId)}>
                  <Feather name="trash-2" size={16} color="#FFF" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}

          {fotos.length < MAX_FOTOS && (
            <TouchableOpacity
              style={[styles.addFotoBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.primary }]}
              onPress={mostrarOpcoes}
            >
              <Feather name="camera" size={32} color={theme.primary} />
              <Text style={[styles.addFotoText, { color: theme.primary }]}>Adicionar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.legenda}>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaDot, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Feather name="cloud" size={12} color="#10B981" />
            </View>
            <Text style={[styles.legendaText, { color: theme.textSecondary }]}>Sincronizado</Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaDot, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Feather name="smartphone" size={12} color="#3B82F6" />
            </View>
            <Text style={[styles.legendaText, { color: theme.textSecondary }]}>Local</Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaDot, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Feather name="alert-circle" size={12} color="#EF4444" />
            </View>
            <Text style={[styles.legendaText, { color: theme.textSecondary }]}>Erro</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal foto ampliada */}
      <Modal visible={!!fotoAmpliada} transparent animationType="fade" onRequestClose={() => setFotoAmpliada(null)}>
        <Pressable style={styles.fotoModalBg} onPress={() => setFotoAmpliada(null)}>
          {fotoAmpliada && (
            <Image source={{ uri: fotoAmpliada }} style={styles.fotoModalImg} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.fotoModalClose} onPress={() => setFotoAmpliada(null)}>
            <Feather name="x" size={20} color="#FFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {fotos.length > 0 && (
        <View style={[styles.footer, { backgroundColor: theme.surfaceHighlight, borderTopColor: theme.border, paddingBottom: fixedFooterBottomPadding(insets) }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: salvando ? theme.textSecondary : theme.primary }]}
            onPress={salvarEvidencias}
            disabled={salvando}
          >
            {salvando
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Feather name="check" size={20} color="#FFF" />
            }
            <Text style={styles.saveBtnText}>
              {salvando ? 'Salvando...' : `Salvar ${fotos.length} Evidência${fotos.length !== 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  titleSection: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  scrollContent: { padding: 24, paddingBottom: 120 },
  instruction: { fontSize: 13, lineHeight: 20, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fotoWrapper: {
    width: '47%', height: 160, borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', position: 'relative',
  },
  foto: { width: '100%', height: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  uploadText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  erroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', gap: 6,
    padding: 10,
  },
  erroText: { color: '#FFF', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, marginTop: 2,
  },
  retryText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },
  syncBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(16,185,129,0.9)',
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  localBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(59,130,246,0.9)',
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(239,68,68,0.9)',
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  addFotoBtn: {
    width: '47%', height: 160, borderRadius: 16, borderWidth: 2,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  addFotoText: { fontSize: 13, fontWeight: '600' },
  legenda: { flexDirection: 'row', gap: 20, marginTop: 16, justifyContent: 'center' },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaDot: {
    width: 22, height: 22, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  legendaText: { fontSize: 12, fontWeight: '500' },
  footer: { padding: 24, paddingBottom: 40, borderTopWidth: 1 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 60, borderRadius: 16, gap: 10,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  fotoModalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  fotoModalImg: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.75,
  },
  fotoModalClose: {
    position: 'absolute', top: 52, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8,
  },
});
