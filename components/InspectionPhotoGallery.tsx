import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { MAX_INSPECTION_PHOTOS } from '../utils/inspectionPhotos';

export interface InspectionPhotoItem {
  id: string;
  uri: string;
  busy?: boolean;
  detail?: string | null;
  error?: boolean;
}

export interface InspectionPhotoGalleryProps {
  photos: InspectionPhotoItem[];
  totalCount?: number;
  busy?: boolean;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  onReplace?: (id: string) => void;
  onRetry?: (id: string) => void;
}

/** Standalone viewer also used by read-only inspection screens. */
export function InspectionPhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const current = useRef(transform);
  const origin = useRef({ scale: 1, x: 0, y: 0, distance: 0 });
  const lastTap = useRef(0);
  const pinching = useRef(false);
  const clamp = (value: number, bound: number) => Math.max(-bound, Math.min(bound, value));
  const update = (scale: number, x = 0, y = 0) => {
    const safe = Math.max(1, Math.min(4, scale));
    const next = { scale: safe, x: clamp(x, width * (safe - 1) / 2), y: clamp(y, height * .65 * (safe - 1) / 2) };
    current.current = next; setTransform(next);
  };
  const distance = (touches: readonly { pageX: number; pageY: number }[]) => touches.length < 2 ? 0 : Math.hypot(touches[1].pageX - touches[0].pageX, touches[1].pageY - touches[0].pageY);
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      origin.current = { ...current.current, distance: distance(event.nativeEvent.touches) };
      pinching.current = origin.current.distance > 0;
    },
    onPanResponderMove: (event, gesture) => {
      const d = distance(event.nativeEvent.touches);
      if (d) {
        pinching.current = true;
        if (!origin.current.distance) origin.current = { ...current.current, distance: d };
        update(origin.current.scale * d / origin.current.distance, origin.current.x, origin.current.y);
      } else if (current.current.scale > 1) update(current.current.scale, origin.current.x + gesture.dx, origin.current.y + gesture.dy);
    },
    onPanResponderRelease: (_, gesture) => {
      if (pinching.current) { lastTap.current = 0; return; }
      if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8) return;
      const now = Date.now();
      if (now - lastTap.current < 300) { update(current.current.scale > 1 ? 1 : 2); lastTap.current = 0; }
      else lastTap.current = now;
    },
    onPanResponderTerminationRequest: () => false,
  }), [width, height]);
  const close = () => { update(1); onClose(); };
  return <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={close} onShow={() => update(1)}>
    <View style={styles.viewer}>
      <View style={[styles.viewerHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.viewerText}>Foto da vistoria</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar foto" onPress={close} style={styles.viewerButton}><Feather name="x" size={26} color="#fff" /></TouchableOpacity>
      </View>
      <View style={styles.viewport} {...gestures.panHandlers}>
        {uri && <Image accessibilityLabel="Foto ampliada" source={{ uri }} resizeMode="contain" style={{ width, height: height * .65, transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }} />}
      </View>
      <View style={[styles.viewerControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.viewerHint}>Use dois dedos ou toque duas vezes para ampliar</Text>
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Diminuir zoom" onPress={() => update(current.current.scale - .5)} style={styles.viewerButton}><Feather name="minus" color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.viewerText}>{Math.round(transform.scale * 100)}%</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Aumentar zoom" onPress={() => update(current.current.scale + .5)} style={styles.viewerButton}><Feather name="plus" color="#fff" size={24} /></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;
}

export function InspectionPhotoGallery({ photos, totalCount = photos.length, busy = false, onAdd, onRemove, onReplace, onRetry }: InspectionPhotoGalleryProps) {
  const { theme } = useTheme();
  const [opened, setOpened] = useState<string | null>(null);
  return <View style={styles.gallery}>
    <Text style={{ color: theme.textSecondary }}>{totalCount} de {MAX_INSPECTION_PHOTOS} fotos · toque para visualizar</Text>
    {photos.map((photo, index) => <View key={photo.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: photo.error ? theme.error : theme.border }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Visualizar foto ${index + 1}`} onPress={() => setOpened(photo.uri)}>
        <Image source={{ uri: photo.uri }} resizeMode="contain" style={styles.thumbnail} />
        <View style={styles.previewHint}><Feather name="maximize-2" size={18} color="#fff" /></View>
      </TouchableOpacity>
      {photo.busy && <View style={styles.metadata}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Processando foto…</Text></View>}
      {photo.detail && <Text style={[styles.detail, { color: theme.textSecondary }]}>{photo.detail}</Text>}
      <View style={styles.actions}>
        {photo.error && onRetry && <TouchableOpacity disabled={busy || photo.busy} onPress={() => onRetry(photo.id)} accessibilityRole="button" accessibilityLabel={`Reenviar foto ${index + 1}`} style={styles.action}><Text style={{ color: theme.error }}>Tentar novamente</Text></TouchableOpacity>}
        {onReplace && <TouchableOpacity disabled={busy || photo.busy} onPress={() => onReplace(photo.id)} accessibilityRole="button" accessibilityLabel={`Substituir foto ${index + 1}`} style={styles.action}><Feather name="camera" size={17} color={theme.primary} /><Text style={{ color: theme.primary }}>Substituir</Text></TouchableOpacity>}
        {onRemove && <TouchableOpacity disabled={busy || photo.busy} onPress={() => onRemove(photo.id)} accessibilityRole="button" accessibilityLabel={`Remover foto ${index + 1}`} style={styles.action}><Feather name="trash-2" size={17} color={theme.error} /><Text style={{ color: theme.error }}>Remover</Text></TouchableOpacity>}
      </View>
    </View>)}
    {onAdd && totalCount < MAX_INSPECTION_PHOTOS && <TouchableOpacity disabled={busy} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Adicionar foto" style={[styles.add, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      {busy ? <ActivityIndicator color={theme.primary} /> : <Feather name="camera" size={28} color={theme.primary} />}
      <Text style={{ color: theme.primary }}>{photos.length ? 'Adicionar outra foto' : 'Tirar foto'}</Text>
    </TouchableOpacity>}
    <InspectionPhotoViewer key={opened ?? 'closed'} uri={opened} onClose={() => setOpened(null)} />
  </View>;
}

const styles = StyleSheet.create({
  gallery: { gap: 12 }, card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  thumbnail: { width: '100%', height: 210, backgroundColor: '#171717' }, previewHint: { position: 'absolute', right: 12, bottom: 12 },
  metadata: { padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }, detail: { fontSize: 12, padding: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12 }, action: { padding: 12, minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center' },
  add: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 24, gap: 8, alignItems: 'center', minHeight: 110 },
  viewer: { flex: 1, backgroundColor: '#111' }, viewerHeader: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewerText: { color: '#fff', fontSize: 16 }, viewerButton: { padding: 12, minHeight: 48, minWidth: 48 }, viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  viewerControls: { alignItems: 'center', gap: 8 }, viewerHint: { color: '#ddd', fontSize: 12, paddingHorizontal: 16 },
});
