import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../context/ThemeContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { updateVistoriaMedia, getVistoriaById, isTrainingVistoria } from '../../../utils/database';
import { syncPendentes } from '../../../services/SyncService';
import { decodePath, getSignedUrl, uploadImageFromLocalUri } from '../../../services/StorageService';
import { compressAndPersistImage, EVIDENCE_IMAGE_MAX_WIDTH } from '../../../utils/imageCompression';
import { AppHeader, Button, EmptyState, SectionHeader, StateBanner } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeBack } from '../../../utils/navigationUtils';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';

const MAX_FOTOS = 3;

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
  const [dirty, setDirty] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const carregarValores = async (valores: string[]): Promise<boolean> => {
      const valoresUnicos = Array.from(new Set(valores.filter(Boolean)));
      if (valoresUnicos.length === 0) return false;
      const itens = await Promise.all(valoresUnicos.map(async stored => {
        const remotePath = decodePath(stored);
        const isHttp = stored.startsWith('http');
        const isRemote = isHttp || remotePath !== null;
        const displayUri = remotePath ? (await getSignedUrl(stored) ?? stored) : stored;
        return {
          localId: stored,
          uri: displayUri,
          // `url` contém o valor persistível, não necessariamente a URI de exibição.
          // Assim caminhos fotos:... nunca são reenviados como arquivos locais.
          url: isRemote ? stored : undefined,
        } satisfies FotoItem;
      }));
      if (!cancelled) setFotos(itens);
      return true;
    };

    void (async () => {
      // Tentar SQLite primeiro
      const local = getVistoriaById(id as string);
      const localIsTraining = isTrainingVistoria(local);
      if (!cancelled) setTrainingMode(localIsTraining);
      if (local) {
        let adicionais: string[] = [];
        try { adicionais = local.fotos_urls ? JSON.parse(local.fotos_urls) : []; } catch { /* noop */ }
        if (await carregarValores([local.foto_url, ...adicionais].filter((value): value is string => Boolean(value)))) {
          return;
        }
      }

      // Fallback: buscar fotosUrls do Supabase (vistorias já sincronizadas)
      if (localIsTraining) return;
      try {
        const { data } = await supabase
          .from('vistorias')
          .select('fotoUrl, fotosUrls')
          .eq('id', id as string)
          .single();
        const urls: string[] = [data?.fotoUrl, ...(data?.fotosUrls ?? [])]
          .filter((value): value is string => Boolean(value));
        await carregarValores(urls);
      } catch { /* sem fotos remotas */ }
    })();

    return () => { cancelled = true; };
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

  const processarFoto = async (uri: string) => {
    if (fotos.length >= MAX_FOTOS) return;
    setDirty(true);

    // Usar localId único para rastrear o item sem depender de índice por closure
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFotos(prev => [...prev, { localId, uri, uploading: true }]);

    try {
      const uriComprimida = await compressAndPersistImage(uri, {
        directoryName: 'fotos/evidencias',
        filePrefix: 'evidencia',
        maxWidth: EVIDENCE_IMAGE_MAX_WIDTH,
      });

      // Só tenta upload se tiver internet real
      if (isOnlineReal && !trainingMode) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const fileName = `vistorias/${id || 'sem-id'}/${Date.now()}.jpg`;
            const storedPath = await uploadImageFromLocalUri(uriComprimida, fileName);
            setFotos(prev => prev.map(f =>
              f.localId === localId
                ? { localId, uri: uriComprimida, url: storedPath, uploading: false }
                : f
            ));
            return;
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
      if (isOnlineReal && !trainingMode) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const fileName = `vistorias/${id || 'sem-id'}/${Date.now()}.jpg`;
          const storedPath = await uploadImageFromLocalUri(foto.uri, fileName);
          setFotos(prev => prev.map(f =>
            f.localId === localId
              ? { ...f, url: storedPath, uploading: false, erro: false }
              : f
          ));
          return;
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
        onPress: () => {
          setDirty(true);
          setFotos(prev => prev.filter(f => f.localId !== localId));
        },
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
      if (isOnlineReal && !trainingMode) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const pendentes = fotosAtualizadas.filter(f => !f.url && !f.erro);
          for (const foto of pendentes) {
            try {
              const fileName = `vistorias/${id || 'sem-id'}/${Date.now()}.jpg`;
              const storedPath = await uploadImageFromLocalUri(foto.uri, fileName);
              fotosAtualizadas = fotosAtualizadas.map(f =>
                f.localId === foto.localId ? { ...f, url: storedPath } : f
              );
            } catch {
              // Não bloqueia — foto fica como local
            }
          }
          // Atualizar estado com as novas URLs sincronizadas
          setFotos(fotosAtualizadas);
        }
      }

      const allUris = fotosAtualizadas.map(f => f.url ?? f.uri);
      const fotoPrincipal = allUris[0] ?? null;
      const fotosAdicionais = allUris.slice(1);

      // Salvar no SQLite local (todas as uris, online ou não)
      if (id) {
        updateVistoriaMedia(id, fotoPrincipal, fotosAdicionais);
      }

      // Salvar URLs no Supabase (incluindo quando todas são removidas — limpar o campo)
      const remotePrincipal = fotosAtualizadas[0]?.url ?? null;
      const remoteUrls = fotosAtualizadas.slice(1).filter(f => f.url).map(f => f.url!);
      if (id && isOnlineReal && !trainingMode) {
        const { error } = await supabase
          .from('vistorias')
          .update({
            fotoUrl: remotePrincipal,
            fotosUrls: remoteUrls.length > 0 ? remoteUrls : null,
          })
          .eq('id', id);
        if (!error) {
          void syncPendentes().catch(() => null);
        }
      }

      safeBack(trainingMode ? '/(panel)/treinamento' : '/(panel)/inspecoes');
    } catch {
      safeBack(trainingMode ? '/(panel)/treinamento' : '/(panel)/inspecoes');
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
      <AppHeader
        title="Evidências fotográficas"
        subtitle={`Vistoria #${id?.toString().slice(0, 6)} · ${fotos.length} de ${MAX_FOTOS}`}
        onBack={() => safeBack(trainingMode ? '/(panel)/treinamento' : '/(panel)/inspecoes')}
        {...(fotos.length < MAX_FOTOS ? {
          actionIcon: 'camera' as const,
          actionLabel: 'Adicionar foto',
          onAction: mostrarOpcoes,
        } : {})}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!isOnlineReal ? (
          <StateBanner
            variant="warning"
            title="Captura offline"
            description="As fotos ficam protegidas neste aparelho até a próxima sincronização."
          />
        ) : (
          <StateBanner
            variant="info"
            title="Registro técnico"
            description="Fotografe a visão geral, os pontos críticos e detalhes que sustentem a avaliação."
          />
        )}

        <SectionHeader title="Galeria da vistoria" subtitle={`Você pode registrar até ${MAX_FOTOS} evidências`} />

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
            <View
              key={foto.localId}
              style={[styles.fotoWrapper, { borderColor: foto.erro ? theme.error : theme.border }]}
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
                      <Feather name="refresh-cw" size={12} color={theme.error} />
                      <Text style={[styles.retryText, { color: theme.error }]}>Tentar novamente</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {foto.url && !foto.erro && (
                <View style={[styles.syncBadge, { backgroundColor: theme.success }]}>
                  <Feather name="cloud" size={12} color={theme.onPrimary} />
                </View>
              )}

              {!foto.url && !foto.uploading && !foto.erro && (
                <View style={[styles.localBadge, { backgroundColor: theme.primary }]}>
                  <Feather name="smartphone" size={12} color={theme.onPrimary} />
                </View>
              )}

              {!foto.uploading && (
                <TouchableOpacity style={[styles.removeBtn, { backgroundColor: theme.error }]} onPress={() => removerFoto(foto.localId)}>
                  <Feather name="trash-2" size={16} color={theme.onPrimary} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {fotos.length < MAX_FOTOS && (
            <TouchableOpacity
              style={[styles.addFotoBtn, { backgroundColor: theme.surface, borderColor: theme.primary }]}
              onPress={mostrarOpcoes}
            >
              <Feather name="camera" size={32} color={theme.primary} />
              <Text style={[styles.addFotoText, { color: theme.primary }]}>Adicionar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.legenda}>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaDot, { backgroundColor: theme.successLight }]}>
              <Feather name="cloud" size={12} color={theme.success} />
            </View>
            <Text style={[styles.legendaText, { color: theme.textSecondary }]}>Sincronizado</Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaDot, { backgroundColor: theme.secondary }]}>
              <Feather name="smartphone" size={12} color={theme.primary} />
            </View>
            <Text style={[styles.legendaText, { color: theme.textSecondary }]}>Local</Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaDot, { backgroundColor: theme.errorLight }]}>
              <Feather name="alert-circle" size={12} color={theme.error} />
            </View>
            <Text style={[styles.legendaText, { color: theme.textSecondary }]}>Erro</Text>
          </View>
        </View>
      </ScrollView>

      {(fotos.length > 0 || dirty) && (
        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
          <Button
            label={fotos.length > 0
              ? `Salvar ${fotos.length} evidência${fotos.length !== 1 ? 's' : ''}`
              : 'Salvar remoção das fotos'}
            onPress={salvarEvidencias}
            loading={salvando}
            iconLeft={<Feather name="check" size={20} color={theme.onPrimary} />}
            fullWidth
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  fotoWrapper: {
    width: '47%', flexGrow: 1, height: 176, borderRadius: SpacingAlias.radiusLg, borderWidth: 1,
    overflow: 'hidden', position: 'relative',
  },
  foto: { width: '100%', height: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  uploadText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  erroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', gap: 6,
    padding: 10,
  },
  erroText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF', borderRadius: SpacingAlias.radiusMd,
    paddingHorizontal: 10, paddingVertical: 5, marginTop: 2,
  },
  retryText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  syncBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  localBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  addFotoBtn: {
    width: '47%', flexGrow: 1, height: 176, borderRadius: SpacingAlias.radiusLg, borderWidth: 1.5,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  addFotoText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[4], justifyContent: 'center' },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaDot: {
    width: 22, height: 22, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  legendaText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  footer: { padding: Spacing[4], borderTopWidth: 1 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 60, borderRadius: 16, gap: 10,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
