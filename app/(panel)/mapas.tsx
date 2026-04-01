import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, Platform,
} from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE, PROVIDER_DEFAULT, MapType } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { getVistoriasByAgente, getVistoriasByMunicipio } from '../../utils/database';
import { logger } from '../../utils/logger';

interface VistoriaMarker {
  id: string;
  lat: number;
  lng: number;
  nivelRisco: string;
  endereco: string;
  agenteNome: string;
  dataVistoria: string | null;
  pontuacaoTotal: number | null;
}

type FilterKey = 'todos' | 'alto' | 'medio' | 'baixo';
type FilterPeriodo = '7d' | '30d' | 'todos';
type MapStyle = 'padrao' | 'satelite' | 'relevo' | 'escuro';

const PERIODOS: { key: FilterPeriodo; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'todos', label: 'Todos' },
];

const MAP_STYLES: { key: MapStyle; label: string; icon: string; desc: string; mapType: MapType }[] = [
  { key: 'padrao',   label: 'Padrão',   icon: 'map',      desc: 'Ruas e estradas',      mapType: 'standard' },
  { key: 'satelite', label: 'Satélite', icon: 'globe',    desc: 'Imagem aérea',          mapType: 'satellite' },
  { key: 'relevo',   label: 'Relevo',   icon: 'triangle', desc: 'Topografia',            mapType: 'terrain' },
  { key: 'escuro',   label: 'Escuro',   icon: 'moon',     desc: 'Modo noturno',          mapType: 'standard' },
];

// Google Maps JSON style para modo escuro
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0B0F19' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B949E' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F19' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C2333' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212A37' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1B2A' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0F1923' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0F1923' }] },
];

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'todos', label: 'Todos', color: '#3B82F6' },
  { key: 'alto',  label: 'Alto',  color: '#EF4444' },
  { key: 'medio', label: 'Médio', color: '#F59E0B' },
  { key: 'baixo', label: 'Baixo', color: '#10B981' },
];

function getRiscoColor(nivel: string): string {
  if (nivel === 'r4') return '#EF4444';
  if (nivel === 'r3') return '#F97316';
  if (nivel === 'r2') return '#F59E0B';
  return '#10B981';
}

function getRiscoLabel(nivel: string): string {
  if (nivel === 'r4') return 'CRÍTICO';
  if (nivel === 'r3') return 'ALTO';
  if (nivel === 'r2') return 'MÉDIO';
  return 'BAIXO';
}

export default function MapasScreen() {
  const { theme } = useTheme();
  const { isOnlineReal } = useConnectivity();
  const { profile } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<VistoriaMarker[]>([]);
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FilterPeriodo>('todos');
  const [mapStyle, setMapStyle] = useState<MapStyle>('padrao');
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<VistoriaMarker | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getUserLocation();
    loadMarkers();
  }, [profile, isOnlineReal]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch { }
  };

  const loadMarkers = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const isAdmin = ['admin', 'master_admin', 'supervisor'].includes(profile.role);

      if (isOnlineReal) {
        let query = supabase
          .from('vistorias')
          .select('id, latitude, longitude, nivelRisco, endereco, agenteNome, dataVistoria, pontuacaoTotal')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (!isAdmin) {
          query = query.eq('agenteUid', profile.uid);
        } else if (profile.municipio && profile.role !== 'master_admin') {
          query = query.eq('municipio', profile.municipio);
        }

        const { data, error } = await query.limit(500);
        if (!error && data) {
          setMarkers(data.filter((v: any) => v.latitude && v.longitude).map((v: any) => ({
            id: v.id,
            lat: Number(v.latitude),
            lng: Number(v.longitude),
            nivelRisco: v.nivelRisco || 'r1',
            endereco: v.endereco || 'Endereço não informado',
            agenteNome: v.agenteNome || '—',
            dataVistoria: v.dataVistoria,
            pontuacaoTotal: v.pontuacaoTotal,
          })));
          return;
        }
      }

      // Offline: SQLite
      const locais = isAdmin
        ? getVistoriasByMunicipio(profile.municipio)
        : getVistoriasByAgente(profile.uid);

      setMarkers(locais.filter((v: any) => v.latitude && v.longitude).map((v: any) => ({
        id: v.id,
        lat: v.latitude,
        lng: v.longitude,
        nivelRisco: v.nivel_risco || 'r1',
        endereco: `${v.endereco_rua || ''}, ${v.endereco_numero || ''} - ${v.endereco_bairro || ''}`,
        agenteNome: v.agente_nome || '—',
        dataVistoria: v.data_vistoria,
        pontuacaoTotal: v.pontuacao_total,
      })));
    } catch (e) {
      logger.error('vistoria', 'Erro ao carregar marcadores do mapa', { erro: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const filteredMarkers = markers.filter(m => {
    if (filter === 'alto' && !(m.nivelRisco === 'r3' || m.nivelRisco === 'r4')) return false;
    if (filter === 'medio' && m.nivelRisco !== 'r2') return false;
    if (filter === 'baixo' && m.nivelRisco !== 'r1') return false;
    if (filtroPeriodo !== 'todos' && m.dataVistoria) {
      const dias = filtroPeriodo === '7d' ? 7 : 30;
      const desde = new Date(Date.now() - dias * 86400000);
      if (new Date(m.dataVistoria) < desde) return false;
    }
    return true;
  });

  const currentStyleConfig = MAP_STYLES.find(s => s.key === mapStyle)!;
  const initialRegion = userLocation
    ? { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: -15.7801, longitude: -47.9292, latitudeDelta: 30, longitudeDelta: 30 };

  const heatmapPoints = filteredMarkers.map(m => ({
    latitude: m.lat,
    longitude: m.lng,
    weight: m.nivelRisco === 'r4' ? 1 : m.nivelRisco === 'r3' ? 0.8 : m.nivelRisco === 'r2' ? 0.5 : 0.3,
  }));

  if (loading) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Carregando mapa...</Text>
      </View>
    );
  }

  if (!isOnlineReal && filteredMarkers.length === 0) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: theme.background }]}>
        <Feather name="wifi-off" size={48} color={theme.border} />
        <Text style={[styles.loadingText, { color: theme.textSecondary, textAlign: 'center' }]}>
          Sem conexão e nenhuma vistoria local.{'\n'}Reconecte para carregar.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ClusteredMapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        mapType={currentStyleConfig.mapType}
        customMapStyle={mapStyle === 'escuro' ? DARK_MAP_STYLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        clusterColor="#3B82F6"
        clusterTextColor="#FFFFFF"
        clusterFontFamily={undefined}
        radius={40}
        onClusterPress={() => {}}
      >
        {!showHeatmap && filteredMarkers.map(m => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            pinColor={getRiscoColor(m.nivelRisco)}
            onPress={() => setSelectedMarker(m)}
          />
        ))}

        {showHeatmap && Platform.OS === 'android' && (
          <Heatmap
            points={heatmapPoints}
            radius={40}
            opacity={0.7}
            gradient={{
              colors: ['#10B981', '#F59E0B', '#EF4444'],
              startPoints: [0.2, 0.5, 1.0],
              colorMapSize: 256,
            }}
          />
        )}
      </ClusteredMapView>

      {/* Header flutuante */}
      <View style={styles.headerOverlay}>
        <TouchableOpacity
          style={[styles.floatBtn, { backgroundColor: theme.surfaceHighlight }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.text} size={20} />
        </TouchableOpacity>

        <View style={[styles.headerInfo, { backgroundColor: theme.surfaceHighlight }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mapa Tático</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            {filteredMarkers.length} vistoria{filteredMarkers.length !== 1 ? 's' : ''}
            {!isOnlineReal ? ' · offline' : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.floatBtn, { backgroundColor: theme.surfaceHighlight }]}
          onPress={loadMarkers}
        >
          <Feather name="refresh-cw" color={theme.text} size={18} />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filtersOverlay}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.chip,
                filter === f.key
                  ? { backgroundColor: f.color }
                  : { backgroundColor: theme.surfaceHighlight, borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, { color: filter === f.key ? '#FFF' : theme.text }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: 1, height: 28, backgroundColor: theme.border, alignSelf: 'center', marginHorizontal: 2 }} />
          {PERIODOS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.chip,
                filtroPeriodo === p.key
                  ? { backgroundColor: theme.primary }
                  : { backgroundColor: theme.surfaceHighlight, borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() => setFiltroPeriodo(p.key)}
            >
              <Text style={[styles.chipText, { color: filtroPeriodo === p.key ? '#FFF' : theme.text }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* FABs direita */}
      <View style={styles.fabGroup}>
        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: showHeatmap ? theme.primary : theme.surfaceHighlight, marginBottom: 10 }]}
            onPress={() => setShowHeatmap(h => !h)}
          >
            <Feather name="zap" size={20} color={showHeatmap ? '#FFF' : theme.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.surfaceHighlight }]}
          onPress={() => setShowStyleModal(true)}
        >
          <Feather name={currentStyleConfig.icon as any} size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Legenda */}
      <View style={[styles.legend, { backgroundColor: theme.surfaceHighlight }]}>
        {[
          { color: '#EF4444', label: 'Crítico' },
          { color: '#F97316', label: 'Alto' },
          { color: '#F59E0B', label: 'Médio' },
          { color: '#10B981', label: 'Baixo' },
        ].map(item => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Popup do marcador selecionado */}
      {selectedMarker && (
        <View style={[styles.markerPopup, { backgroundColor: theme.surfaceHighlight }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={[styles.riscoBadge, { backgroundColor: getRiscoColor(selectedMarker.nivelRisco) }]}>
              <Text style={styles.riscoBadgeText}>{getRiscoLabel(selectedMarker.nivelRisco)}</Text>
            </View>
            {selectedMarker.pontuacaoTotal != null && (
              <Text style={[{ fontSize: 12, color: theme.textSecondary }]}>{selectedMarker.pontuacaoTotal}pts</Text>
            )}
            <TouchableOpacity onPress={() => setSelectedMarker(null)} style={{ marginLeft: 'auto' }}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.popupEndereco, { color: theme.text }]} numberOfLines={2}>{selectedMarker.endereco}</Text>
          <Text style={[styles.popupAgente, { color: theme.textSecondary }]}>
            {selectedMarker.agenteNome} · {selectedMarker.dataVistoria ? new Date(selectedMarker.dataVistoria).toLocaleDateString('pt-BR') : '—'}
          </Text>
          <TouchableOpacity
            style={[styles.popupBtn, { backgroundColor: '#EFF6FF' }]}
            onPress={() => { setSelectedMarker(null); router.push(`/(panel)/inspecoes/${selectedMarker.id}`); }}
          >
            <Text style={{ color: '#3B82F6', fontSize: 13, fontWeight: '700' }}>Ver detalhes →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal estilo do mapa */}
      <Modal
        visible={showStyleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStyleModal(false)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowStyleModal(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surfaceHighlight }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Estilo do Mapa</Text>
          {MAP_STYLES.map(s => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.styleRow,
                { backgroundColor: s.key === mapStyle ? `${theme.primary}12` : theme.iconBackground },
                s.key === mapStyle && { borderColor: theme.primary, borderWidth: 2 },
              ]}
              onPress={() => { setMapStyle(s.key); setShowStyleModal(false); }}
            >
              <View style={[styles.styleIcon, { backgroundColor: s.key === mapStyle ? `${theme.primary}20` : `${theme.border}50` }]}>
                <Feather name={s.icon as any} size={22} color={s.key === mapStyle ? theme.primary : theme.textSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.styleLabel, { color: theme.text }]}>{s.label}</Text>
                <Text style={[styles.styleDesc, { color: theme.textSecondary }]}>{s.desc}</Text>
              </View>
              {s.key === mapStyle && <Feather name="check-circle" size={20} color={theme.primary} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 8 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  loadingText: { fontSize: 14, fontWeight: '500', marginTop: 8 },

  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 54, paddingBottom: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  floatBtn: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  headerInfo: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  filtersOverlay: {
    position: 'absolute', top: 118, left: 0, right: 0, paddingHorizontal: 16,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  fabGroup: { position: 'absolute', right: 16, bottom: 150 },
  fab: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
    marginBottom: 10,
  },

  legend: {
    position: 'absolute', bottom: 68, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 10, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 10, fontWeight: '600' },

  markerPopup: {
    position: 'absolute', bottom: 120, left: 16, right: 16,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  riscoBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  riscoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  popupEndereco: { fontSize: 14, fontWeight: '600', marginBottom: 4, lineHeight: 20 },
  popupAgente: { fontSize: 12, marginBottom: 10 },
  popupBtn: { borderRadius: 10, padding: 10, alignItems: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  styleRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
  },
  styleIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  styleLabel: { fontSize: 15, fontWeight: '700' },
  styleDesc: { fontSize: 12, marginTop: 2 },
});
