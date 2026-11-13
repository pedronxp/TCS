import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { updateVistoriaMedia, getVistoriaById, isTrainingVistoria } from '../../../utils/database';
import { syncPendentes } from '../../../services/SyncService';
import { decodePath, getSignedUrl, uploadImageFromLocalUri } from '../../../services/StorageService';
import {
  capturarFotoGeorreferenciada,
  lerGeorreferenciaDoArquivo,
  registrarGeorreferenciaDaGaleria,
  solicitarPermissaoCamera as pedirPermissaoCamera,
} from '../../../services/georeferencedPhotoService';
import { formatGeoForDocument } from '../../../supabase/functions/_shared/exifGps';
import { AppHeader, Button, EmptyState, SectionHeader, StateBanner } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeBack } from '../../../utils/navigationUtils';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';
import { InspectionPhotoGallery } from '../../../components/InspectionPhotoGallery';
import { createCaptureGate, MAX_INSPECTION_PHOTOS } from '../../../utils/inspectionPhotos';
import { finishInspectionMedia, prepareInspectionMedia } from '../../../services/InspectionMediaService';
import { buildInspectionMediaManifest, type InspectionMediaManifest, type InspectionMediaItem } from '../../../utils/inspectionMedia';
import { getRemoteInspectionPhotoDraft, removeRemoteInspectionPhotoDraft, saveRemoteInspectionPhotoDraft, type RemoteInspectionPhotoDraft } from '../../../services/RemoteInspectionPhotoDraftService';
import { preservePendingPhotoSlots, remotePhotoDraftConflicts } from '../../../utils/remotePhotoDraft';

const MAX_FOTOS = MAX_INSPECTION_PHOTOS;

interface FotoItem {
  localId: string;       // identificador único para rastrear updates sem depender de índice
  uri: string;
  uploading?: boolean;
  url?: string;
  erro?: boolean;
  /** Linha de proveniência da foto (coordenada, instante e hash). */
  proveniencia?: string | null;
  evidenceId?: string;
}

export default function FotoScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  // useLocalSearchParams pode retornar string ou string[] — normalizar para string
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { isOnlineReal } = useConnectivity();
  const [fotos, setFotosState] = useState<FotoItem[]>([]);
  const fotosRef = React.useRef<FotoItem[]>([]);
  const setFotos: React.Dispatch<React.SetStateAction<FotoItem[]>> = update => {
    const next = typeof update === 'function' ? update(fotosRef.current) : update;
    fotosRef.current = next;
    setFotosState(next);
  };
  const [salvando, setSalvando] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const capturaEmAndamento = React.useRef(createCaptureGate()).current;
  const [dirty, setDirty] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [trainingMode, setTrainingMode] = useState(false);
  const manifestRef = React.useRef<InspectionMediaManifest | null>(null);
  const remoteRevision = React.useRef<number | null>(null);
  const remoteRevisionKnown = React.useRef(false);
  const restoredDraft = React.useRef<RemoteInspectionPhotoDraft | null>(null);
  const editBaseRevision = React.useRef<number | null | undefined>(undefined);
  const pendingRemoteItems = React.useRef<InspectionMediaItem[]>([]);
  const remoteOrder = React.useRef<string[]>([]);
  const [draftConflict, setDraftConflict] = useState(false);
  const photoDraftKey = profile?.uid && id ? `@inspection_photo_draft:${profile.uid}:${id}` : null;
  const mediaRecord = () => ({
    id: id || '', agente_uid: getVistoriaById(id || '')?.agente_uid || profile?.uid || '',
    foto_url: fotosRef.current[0]?.url ?? fotosRef.current[0]?.uri ?? null,
    fotos_urls: JSON.stringify(fotosRef.current.slice(1).map(f => f.url ?? f.uri)),
  });
  const missingRemoteItems = () => pendingRemoteItems.current.filter(item => !fotosRef.current.some(f => f.evidenceId === item.id));
  const totalPhotos = () => fotosRef.current.length + missingRemoteItems().length;
  const photoIdentities = () => fotosRef.current.map(f => f.evidenceId!);
  const composeManifest = (manifest: InspectionMediaManifest) => {
    const actual = { ...manifest, items: manifest.items.map((item, index) => ({ ...item, id: fotosRef.current[index]?.evidenceId ?? item.id })) };
    setFotos(prev => prev.map((f, index) => ({ ...f, evidenceId: actual.items[index]?.id })));
    return preservePendingPhotoSlots(actual, pendingRemoteItems.current, remoteOrder.current);
  };
  const prepareMedia = async () => {
    if (draftConflict) throw new Error('media_revision_conflict');
    const record = mediaRecord();
    let manifest = await prepareInspectionMedia(record);
    if (restoredDraft.current) {
      // Keep the base against which the draft was created. Observing a newer
      // server revision is not permission to replay stale paths over it.
      const draft = restoredDraft.current;
      const newEditOfPublishedDraft = manifest.revision !== draft.revision && remoteRevision.current === draft.revision;
      manifest = { ...manifest, base_revision: newEditOfPublishedDraft ? draft.revision : draft.baseRevision ?? null };
    } else if (remoteRevision.current !== null) {
      manifest = { ...manifest, base_revision: editBaseRevision.current ?? remoteRevision.current };
      if (manifest.revision <= remoteRevision.current) manifest = await finishInspectionMedia(record, { ...manifest, revision: remoteRevision.current + 1 });
    }
    manifest = composeManifest(manifest);
    manifestRef.current = manifest;
    if (profile?.uid && id && !isTrainingVistoria(getVistoriaById(id))) {
      await saveRemoteInspectionPhotoDraft(profile.uid, id, fotosRef.current.map(f => f.url ?? f.uri), manifest.revision, manifest.base_revision, false, photoIdentities(), missingRemoteItems(), remoteOrder.current);
    }
    return manifest;
  };
  const preserveFinishedMedia = async (manifest: InspectionMediaManifest) => {
    const actualItems = photoIdentities().map(identity => manifest.items.find(item => item.id === identity)!).filter(Boolean);
    manifestRef.current = composeManifest(await finishInspectionMedia(mediaRecord(), { ...manifest, items: actualItems }));
    if (profile?.uid && id && !trainingMode) await saveRemoteInspectionPhotoDraft(profile.uid, id, fotosRef.current.map(f => f.url ?? f.uri), manifest.revision, manifest.base_revision, false, photoIdentities(), missingRemoteItems(), remoteOrder.current);
    return manifestRef.current;
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const carregarValores = async (valores: string[], identities: string[] = []): Promise<boolean> => {
      const valoresUnicos = Array.from(new Set(valores.filter(Boolean)));
      if (valoresUnicos.length === 0) return false;
      const itens = await Promise.all(valoresUnicos.map(async (stored, index) => {
        const remotePath = decodePath(stored);
        const isHttp = stored.startsWith('http');
        const isRemote = isHttp || remotePath !== null;
        const displayUri = remotePath ? (await getSignedUrl(stored) ?? stored) : stored;
        // Fotos locais ainda carregam o EXIF gravado na captura: a
        // georreferência reaparece sem precisar baixar o arquivo.
        const geo = stored.startsWith('file://')
          ? await lerGeorreferenciaDoArquivo(stored)
          : null;
        return {
          localId: stored,
          uri: displayUri,
          // `url` contém o valor persistível, não necessariamente a URI de exibição.
          // Assim caminhos fotos:... nunca são reenviados como arquivos locais.
          url: isRemote ? stored : undefined,
          proveniencia: geo ? formatGeoForDocument(geo) : null,
          evidenceId: identities[index] || undefined,
        } satisfies FotoItem;
      }));
      if (!cancelled) setFotos(itens);
      return true;
    };

    void (async () => {
      if (isOnlineReal) {
        try {
          const { data, error } = await supabase.rpc('get_inspection_media_status', { p_inspection_id: id });
          const status = Array.isArray(data) ? data[0] : data;
          if (!cancelled && !error && status && 'revision' in status) {
            remoteRevision.current = status.revision ?? null;
            remoteRevisionKnown.current = true;
          }
        } catch { /* cached revision is retained offline */ }
      }
      // A remote inspection may not exist in this phone's SQLite database.
      // Keep its local attachments recoverable even when upload fails.
      if (photoDraftKey) {
        try {
          const draft = await getRemoteInspectionPhotoDraft(profile!.uid, id);
          if (Array.isArray(draft?.paths)) {
            restoredDraft.current = draft;
            editBaseRevision.current = draft.baseRevision;
            pendingRemoteItems.current = draft.pendingItems ?? [];
            remoteOrder.current = draft.remoteOrder ?? [];
            await carregarValores(draft.paths, draft.identities);
            const restored = { ...buildInspectionMediaManifest(id, draft.paths[0], draft.paths.slice(1), draft.revision, draft.identities), base_revision: draft.baseRevision ?? null };
            await finishInspectionMedia(mediaRecord(), restored);
            manifestRef.current = preservePendingPhotoSlots(restored, pendingRemoteItems.current, remoteOrder.current);
            if (!cancelled) { setDirty(true); setDraftConflict(draft.error === 'media_revision_conflict' || remotePhotoDraftConflicts(draft, remoteRevision.current, remoteRevisionKnown.current)); }
            return;
          }
        } catch { /* malformed local draft falls back to the inspection */ }
      }
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
          .select('fotoUrl, fotosUrls, media_manifest')
          .eq('id', id as string)
          .single();
        const urls: string[] = [data?.fotoUrl, ...(data?.fotosUrls ?? [])]
          .filter((value): value is string => Boolean(value));
        const remoteManifest = data?.media_manifest as InspectionMediaManifest | undefined;
        if (remoteManifest?.version === 1 && Array.isArray(remoteManifest.items)) {
          pendingRemoteItems.current = remoteManifest.items.filter(item => item.state !== 'available' && item.state !== 'removed');
          remoteOrder.current = remoteManifest.items.map(item => item.id);
        }
        await carregarValores(urls, urls.map(path => remoteManifest?.items.find(item => item.storagePath === path)?.id ?? ''));
        if (!cancelled) { remoteRevision.current = remoteManifest?.revision ?? null; editBaseRevision.current = remoteRevision.current; }
      } catch { /* sem fotos remotas */ }
    })().finally(() => { if (!cancelled) setLoadingPhotos(false); });

    return () => { cancelled = true; };
  }, [id, photoDraftKey]);

  const solicitarPermissaoCamera = async (): Promise<boolean> => {
    const ok = await pedirPermissaoCamera();
    if (!ok) {
      Alert.alert(
        'Permissão necessária',
        'O app precisa de acesso à câmera para registrar evidências fotográficas.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  /**
   * Registra a foto já persistida em disco e a envia ao Storage quando há
   * internet. Não recomprime: a compressão reescreve o JPEG e apagaria o EXIF
   * GPS gravado na captura.
   */
  const registrarFoto = async (uri: string, proveniencia?: string | null, replaceId?: string) => {
    if (replaceId && !fotosRef.current.some(f => f.localId === replaceId)) return;
    if (!replaceId && totalPhotos() >= MAX_FOTOS) return;
    setDirty(true);

    // Usar localId único para rastrear o item sem depender de índice por closure
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newPhoto = { localId, uri, uploading: true, proveniencia, evidenceId: replaceId ? fotosRef.current.find(f => f.localId === replaceId)?.evidenceId : undefined };
    setFotos(prev => replaceId ? prev.map(f => f.localId === replaceId ? newPhoto : f) : [...prev, newPhoto]);

    try {
      const manifest = await prepareMedia();
      // Só tenta upload se tiver internet real
      if (isOnlineReal && !trainingMode) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            if (!id) throw new Error('Vistoria não identificada.');
            const storedPath = await uploadImageFromLocalUri(uri, id);
            setFotos(prev => prev.map(f =>
              f.localId === localId
                ? { ...f, url: storedPath, uploading: false }
                : f
            ));
            await preserveFinishedMedia(manifest);
            return;
          }
        } catch {
          // Upload falhou — cai para salvar localmente
        }
      }

      // Offline ou upload falhou — salvar só URI local
      setFotos(prev => prev.map(f =>
        f.localId === localId
          ? { ...f, uploading: false }
          : f
      ));
    } catch (e) {
      setFotos(prev => prev.map(f =>
        f.localId === localId ? { ...f, uploading: false, erro: true } : f
      ));
    }
  };

  const tirarFoto = async (replaceId?: string) => {
    if (draftConflict || loadingPhotos || fotosRef.current.some(f => f.uploading) || salvando) return;
    if (!replaceId && totalPhotos() >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS} fotos por vistoria.`);
      return;
    }
    if (!capturaEmAndamento.enter()) return;
    setCapturando(true);
    try {
      const ok = await solicitarPermissaoCamera();
      if (!ok) return;

      const resultado = await capturarFotoGeorreferenciada();
      if (resultado.cancelado || !resultado.foto) return;

      await registrarFoto(resultado.foto.uri, resultado.foto.geo ? formatGeoForDocument(resultado.foto.geo) : null, replaceId);
      if (resultado.foto.avisoCarimbo) {
        Alert.alert('Foto salva sem carimbo visual', resultado.foto.avisoCarimbo);
      } else if (resultado.foto.semGeorreferencia) {
        Alert.alert('Foto sem localização', 'A foto foi salva com o aviso de localização indisponível. Verifique o GPS e a permissão de localização para tentar novamente.');
      }
    } catch {
      Alert.alert('Não foi possível registrar a foto', 'Tente novamente.');
    } finally {
      capturaEmAndamento.release();
      setCapturando(false);
    }
  };

  const escolherDaGaleria = async () => {
    if (draftConflict || loadingPhotos || fotosRef.current.some(f => f.uploading) || salvando) return;
    if (totalPhotos() >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS} fotos por vistoria.`);
      return;
    }
    if (!capturaEmAndamento.enter()) return;
    setCapturando(true);
    try {
    const disponivel = MAX_FOTOS - totalPhotos();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: disponivel,
    });

    if (result.canceled || !result.assets?.length) return;
    // Processar cada foto selecionada em sequência
    for (const asset of result.assets) {
      // Foto de galeria preserva apenas o EXIF original: o GPS do aparelho
      // descreve onde o agente está, não onde a foto foi tirada.
      const foto = await registrarGeorreferenciaDaGaleria(asset.uri);
      await registrarFoto(foto.uri, foto.geo ? formatGeoForDocument(foto.geo) : null);
    }
    } catch {
      Alert.alert('Não foi possível adicionar a foto', 'Tente novamente.');
    } finally {
      capturaEmAndamento.release();
      setCapturando(false);
    }
  };

  const tentarNovamente = async (localId: string) => {
    const foto = fotosRef.current.find(f => f.localId === localId);
    if (!foto || draftConflict || fotosRef.current.some(f => f.uploading) || capturando || salvando) return;

    setFotos(prev => prev.map(f =>
      f.localId === localId ? { ...f, erro: false, uploading: true } : f
    ));

    try {
      const manifest = manifestRef.current ?? await prepareMedia();
      if (isOnlineReal && !trainingMode) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (!id) throw new Error('Vistoria não identificada.');
          const storedPath = await uploadImageFromLocalUri(foto.uri, id);
          setFotos(prev => prev.map(f =>
            f.localId === localId
              ? { ...f, url: storedPath, uploading: false, erro: false }
              : f
          ));
          await preserveFinishedMedia(manifest);
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
    Alert.alert('Remover foto?', 'A foto será removida desta vistoria ao salvar as evidências.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: () => {
          setDirty(true);
          setFotos(prev => prev.filter(f => f.localId !== localId));
          void prepareMedia().catch(() => Alert.alert('Não foi possível preservar a alteração', 'Tente salvar as evidências antes de sair.'));
        },
      },
    ]);
  };

  const salvarEvidencias = async () => {
    if (draftConflict) {
      Alert.alert('Fotos alteradas em outro dispositivo', 'Este rascunho foi preservado, mas não pode substituir uma versão mais recente. Recarregue a vistoria e confira as evidências antes de resolver a pendência.');
      return;
    }
    if (capturando || salvando || fotosRef.current.some(f => f.uploading)) {
      Alert.alert('Aguarde', 'Ainda há fotos sendo processadas.');
      return;
    }
    setSalvando(true);
    try {
      // Freeze revision before network work, so an older upload cannot undo a
      // removal made by another device while this request was in flight.
      const preparedManifest = await prepareMedia();
      // Se online, tentar re-upload de fotos locais que ainda não foram sincronizadas
      let fotosAtualizadas = [...fotos];
      if (isOnlineReal && !trainingMode) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const pendentes = fotosAtualizadas.filter(f => !f.url && !f.erro);
          for (const foto of pendentes) {
            try {
              const storedPath = await uploadImageFromLocalUri(foto.uri, id);
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
      const manifest = await preserveFinishedMedia(preparedManifest);

      // Salvar no SQLite local (todas as uris, online ou não)
      if (id) {
        updateVistoriaMedia(id, fotoPrincipal, fotosAdicionais);
      }

      // Salvar URLs no Supabase (incluindo quando todas são removidas — limpar o campo)
      const remotePrincipal = fotosAtualizadas[0]?.url ?? null;
      const remoteUrls = fotosAtualizadas.slice(1).filter(f => f.url).map(f => f.url!);
      if (id && isOnlineReal && !trainingMode) {
        const { error } = await supabase.rpc('update_inspection_media', {
          p_inspection_id: id,
          p_primary_photo: remotePrincipal,
          p_extra_photos: remoteUrls,
          p_media_manifest: manifest,
        });
        if (error) throw error;
        remoteRevision.current = manifest.revision;
        void syncPendentes().catch(() => null);
      }

      if (photoDraftKey && (trainingMode || (isOnlineReal && fotosAtualizadas.every(f => f.url)))) {
        await removeRemoteInspectionPhotoDraft(profile!.uid, id, manifest.revision);
      } else if (profile?.uid && id && !trainingMode) {
        await saveRemoteInspectionPhotoDraft(profile.uid, id, allUris, manifest.revision, manifest.base_revision, true, photoIdentities(), missingRemoteItems(), remoteOrder.current);
      }

      safeBack(trainingMode ? '/(panel)/treinamento' : '/(panel)/inspecoes');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String((cause as { message?: string })?.message || '');
      if (manifestRef.current && profile?.uid && id && !trainingMode && !message.includes('media_revision_conflict')) {
        const manifest = manifestRef.current;
        await saveRemoteInspectionPhotoDraft(profile.uid, id, fotosRef.current.map(f => f.url ?? f.uri), manifest.revision, manifest.base_revision, true, photoIdentities(), missingRemoteItems(), remoteOrder.current);
      }
      if (message.includes('media_revision_conflict')) setDraftConflict(true);
      Alert.alert('Não foi possível salvar', message.includes('media_revision_conflict')
        ? 'As fotos foram alteradas em outro dispositivo. Volte e abra a galeria novamente para carregar a versão atual.'
        : 'As fotos continuam neste aparelho. Verifique a conexão e tente salvar novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const mostrarOpcoes = () => {
    Alert.alert('Adicionar Foto', 'Como deseja adicionar a foto?', [
      { text: 'Câmera', onPress: () => void tirarFoto() },
      { text: 'Galeria', onPress: escolherDaGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Evidências fotográficas"
        subtitle={`Vistoria #${id?.toString().slice(0, 6)} · ${fotos.length} disponíveis · ${missingRemoteItems().length} pendentes`}
        onBack={() => safeBack(trainingMode ? '/(panel)/treinamento' : '/(panel)/inspecoes')}
        {...(!draftConflict && totalPhotos() < MAX_FOTOS && !loadingPhotos && !capturando && !salvando && !fotos.some(f => f.uploading) ? {
          actionIcon: 'camera' as const,
          actionLabel: 'Adicionar foto',
          onAction: mostrarOpcoes,
        } : {})}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {draftConflict && <>
          <StateBanner variant="warning" title="Fotos alteradas em outro dispositivo" description="Seu rascunho foi preservado. Ele não será enviado automaticamente sobre a versão mais recente." />
          <TouchableOpacity accessibilityRole="button" style={{ minHeight: 44, padding: 12 }} onPress={() => Alert.alert(
            'Descartar rascunho e recarregar?',
            'As alterações fotográficas pendentes deste rascunho deixarão de ser enviadas. As evidências atuais do servidor não serão alteradas.',
            [{ text: 'Manter rascunho', style: 'cancel' }, { text: 'Descartar rascunho', style: 'destructive', onPress: () => {
              if (profile?.uid && id) void removeRemoteInspectionPhotoDraft(profile.uid, id).then(() => safeBack('/(panel)/inspecoes')).catch(() => Alert.alert('Não foi possível recarregar', 'Tente novamente.'));
            } }],
          )}><Text style={{ color: theme.primary }}>Descartar rascunho e abrir a versão atual</Text></TouchableOpacity>
        </>}
        {capturando && <StateBanner variant="info" title="Preparando a foto" description="Obtendo localização e gravando o carimbo na imagem…" />}
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

        {missingRemoteItems().map(item => <StateBanner key={item.id} variant="warning" title={`Foto ${item.position + 1} pendente de outro aparelho`} description="Esta evidência faz parte da vistoria, mas o arquivo ainda não foi enviado pelo aparelho de origem. Alterar uma foto disponível não remove esta pendência." />)}

        <InspectionPhotoGallery
          totalCount={totalPhotos()}
          photos={fotos.map(foto => ({
            id: foto.localId,
            uri: foto.uri,
            busy: foto.uploading,
            error: foto.erro,
            detail: foto.proveniencia || (foto.url ? 'Sincronizada' : 'Neste aparelho · envio pendente'),
          }))}
          busy={draftConflict || loadingPhotos || capturando || salvando || fotos.some(f => f.uploading)}
          onAdd={mostrarOpcoes}
          onRemove={removerFoto}
          onReplace={localId => void tirarFoto(localId)}
          onRetry={localId => void tentarNovamente(localId)}
        />

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
            disabled={!dirty || capturando || fotos.some(f => f.uploading)}
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
    width: '47%', flexGrow: 1, minHeight: 176, borderRadius: SpacingAlias.radiusLg, borderWidth: 1,
    overflow: 'hidden', position: 'relative',
  },
  foto: { width: '100%', height: 176, backgroundColor: '#171717' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  uploadText: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  erroOverlay: {
    ...StyleSheet.absoluteFill,
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
  provenienciaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 6, paddingVertical: 4,
  },
  provenienciaTexto: {
    color: '#FFF', fontSize: 9, fontWeight: FontWeight.medium, flex: 1,
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
