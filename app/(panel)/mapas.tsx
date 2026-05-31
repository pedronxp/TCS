import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, Platform,
} from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE, PROVIDER_DEFAULT, MapType } from 'react-native-maps';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { getVistoriasByAgente, getVistoriasByMunicipio, getAllVistorias, getAllAgendamentos, getAgendamentosByMunicipio, getAgendamentosByAgente } from '../../utils/database';
import { logger } from '../../utils/logger';
import { tracarRota } from '../../utils/routingUtils';
import { hasValidCoordinates, normalizeCoordinatePair } from '../../utils/coordinateUtils';
import type { ValidCoordinates } from '../../utils/coordinateUtils';
import { navSystemBottom } from '../../utils/useBottomTabPadding';
import { safeBack } from '../../utils/navigationUtils';

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

interface AgendamentoMarker {
  id: string;
  lat: number;
  lng: number;
  titulo: string;
  endereco: string;
  dataAgendada: string;
  agenteNome: string;
  status: string;
}

type FilterKey    = 'todos' | 'alto' | 'medio' | 'baixo';
type FilterPeriodo = '7d' | '30d' | 'todos';
type MapStyle     = 'padrao' | 'satelite' | 'relevo' | 'escuro';

const PERIODOS: { key: FilterPeriodo; label: string }[] = [
  { key: '7d',   label: '7 dias' },
  { key: '30d',  label: '30 dias' },
  { key: 'todos', label: 'Todos' },
];

const MAP_STYLES: { key: MapStyle; label: string; icon: string; desc: string; mapType: MapType }[] = [
  { key: 'padrao',   label: 'Padrão',   icon: 'map',      desc: 'Ruas e estradas', mapType: 'standard'  },
  { key: 'satelite', label: 'Satélite', icon: 'globe',    desc: 'Imagem aérea',   mapType: 'satellite' },
  { key: 'relevo',   label: 'Relevo',   icon: 'triangle', desc: 'Topografia',     mapType: 'terrain'   },
  { key: 'escuro',   label: 'Escuro',   icon: 'moon',     desc: 'Modo noturno',   mapType: 'standard'  },
];

const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#0B0F19' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#8B949E' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0B0F19' }] },
  { featureType: 'road',  elementType: 'geometry',        stylers: [{ color: '#1C2333' }] },
  { featureType: 'road',  elementType: 'geometry.stroke', stylers: [{ color: '#212A37' }] },
  { featureType: 'water', elementType: 'geometry',        stylers: [{ color: '#0D1B2A' }] },
  { featureType: 'poi',   elementType: 'geometry',        stylers: [{ color: '#0F1923' }] },
  { featureType: 'transit', elementType: 'geometry',      stylers: [{ color: '#0F1923' }] },
];

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'todos', label: 'Todos', color: '#3B82F6' },
  { key: 'alto',  label: 'Alto',  color: '#EF4444' },
  { key: 'medio', label: 'Médio', color: '#F59E0B' },
  { key: 'baixo', label: 'Baixo', color: '#10B981' },
];

// Normaliza níveis legados (alto/medio/baixo → r3/r2/r1)
function normalizeNivel(nivel: string): string {
  if (nivel === 'alto')  return 'r3';
  if (nivel === 'medio') return 'r2';
  if (nivel === 'baixo') return 'r1';
  return nivel;
}

function getRiscoColor(nivel: string): string {
  const n = normalizeNivel(nivel);
  if (n === 'r4') return '#EF4444';
  if (n === 'r3') return '#F97316';
  if (n === 'r2') return '#F59E0B';
  return '#10B981';
}

function getRiscoLabel(nivel: string): string {
  const n = normalizeNivel(nivel);
  if (n === 'r4') return 'CRÍTICO';
  if (n === 'r3') return 'ALTO';
  if (n === 'r2') return 'MÉDIO';
  return 'BAIXO';
}

function getRiscoShortLabel(nivel: string): string {
  const n = normalizeNivel(nivel);
  if (n === 'r4') return 'R4';
  if (n === 'r3') return 'R3';
  if (n === 'r2') return 'R2';
  return 'R1';
}

// Tamanhos do marcador — visual neutro para não sumir no mapa do Android.
const PIN_WRAP_WIDTH  = Platform.OS === 'android' ? 52 : 44;
const PIN_WRAP_HEIGHT = Platform.OS === 'android' ? 78 : 68;
const PIN_HEAD        = Platform.OS === 'android' ? 42 : 34;
const PIN_CENTER      = Platform.OS === 'android' ? 17 : 14;
const PIN_TIP         = Platform.OS === 'android' ? 16 : 13;
const PIN_ACCENT      = Platform.OS === 'android' ? 11 : 8;
const ICON_SIZE       = Platform.OS === 'android' ? 18 : 15;
const MARKER_ANCHOR = { x: 0.5, y: 1 };
const MARKER_CENTER_OFFSET = { x: 0, y: 0 };
const USE_NATIVE_ANDROID_MARKERS = Platform.OS === 'android';

// Marcador customizado sem pinColor para manter renderização consistente no mapa nativo.
function MarkerPin({ color, label }: { color: string; label: string }) {
  return (
    <View style={markerStyles.markerWrap}>
      <View style={markerStyles.pinShadow}>
        <View style={[markerStyles.pinHead, { borderColor: color }]}>
          <View style={[markerStyles.pinCenter, { backgroundColor: color }]} />
          <View style={[markerStyles.riskAccent, { backgroundColor: color }]} />
        </View>
        <View style={[markerStyles.pinTip, { borderColor: color }]} />
      </View>
      <View style={markerStyles.labelBadge}>
        <Text style={[markerStyles.labelBadgeText, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

function AgendamentoPin() {
  return (
    <View style={markerStyles.markerWrap}>
      <View style={markerStyles.pinShadow}>
        <View style={[markerStyles.pinHead, { borderColor: '#3B82F6' }]}>
          <Feather name="calendar" size={ICON_SIZE} color="#475569" />
          <View style={[markerStyles.riskAccent, { backgroundColor: '#3B82F6' }]} />
        </View>
        <View style={[markerStyles.pinTip, { borderColor: '#3B82F6' }]} />
      </View>
      <View style={markerStyles.labelBadge}>
        <Text style={[markerStyles.labelBadgeText, { color: '#3B82F6' }]}>AG</Text>
      </View>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  markerWrap: {
    width: PIN_WRAP_WIDTH,
    height: PIN_WRAP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pinShadow: {
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
  },
  pinCenter: {
    width: PIN_CENTER,
    height: PIN_CENTER,
    borderRadius: PIN_CENTER / 2,
    backgroundColor: '#475569',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  riskAccent: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: PIN_ACCENT,
    height: PIN_ACCENT,
    borderRadius: PIN_ACCENT / 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  pinTip: {
    width: PIN_TIP,
    height: PIN_TIP,
    marginTop: -5,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    transform: [{ rotate: '45deg' }],
  },
  labelBadge: {
    minWidth: 32,
    height: 20,
    marginTop: -1,
    paddingHorizontal: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 5,
  },
  labelBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
});

export default function MapasScreen() {
  const { theme } = useTheme();
  const { isOnlineReal } = useConnectivity();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  // Altura real da BottomNavBar + barra de navegação do sistema
  const bottomNavH = 68 + navSystemBottom(insets);
  const mapRef = useRef<MapView>(null);
  const currentRegionRef = useRef<any>(null); // região atual do mapa (atualizada pelo onRegionChangeComplete)
  const isInitialLoadRef = useRef(true);
  const mountedRef = useRef(true);
  const timer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerRenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading]           = useState(true);
  const [markers, setMarkers]           = useState<VistoriaMarker[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoMarker[]>([]);
  const [filter, setFilter]             = useState<FilterKey>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FilterPeriodo>('todos');
  const [mapStyle, setMapStyle]         = useState<MapStyle>('padrao');
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showHeatmap, setShowHeatmap]   = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<VistoriaMarker | null>(null);
  const [selectedAgendamento, setSelectedAgendamento] = useState<AgendamentoMarker | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tracksMarkerChanges, setTracksMarkerChanges] = useState(true);
  const [mapVisible, setMapVisible] = useState(true);

  const clearMapTimers = useCallback(() => {
    if (timer1Ref.current) clearTimeout(timer1Ref.current);
    if (timer2Ref.current) clearTimeout(timer2Ref.current);
    if (markerRenderTimerRef.current) clearTimeout(markerRenderTimerRef.current);
    timer1Ref.current = null;
    timer2Ref.current = null;
    markerRenderTimerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    getUserLocation();
    loadMarkers();
    return () => {
      mountedRef.current = false;
      clearMapTimers();
    };
  }, [profile, isOnlineReal, clearMapTimers]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const valid = normalizeCoordinatePair(loc.coords.latitude, loc.coords.longitude);
      if (!valid || !mountedRef.current) return;
      const coords = { lat: valid.latitude, lng: valid.longitude };
      setUserLocation(coords);
      mapRef.current?.animateToRegion({
        latitude: coords.lat, longitude: coords.lng,
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      }, 1000);
    } catch { }
  };

  const goToUserLocation = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({
      latitude: userLocation.lat, longitude: userLocation.lng,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    }, 800);
  };

  const fitToMarkers = (list?: VistoriaMarker[]) => {
    const vCoords = (list ?? filteredMarkers)
      .map(m => normalizeCoordinatePair(m.lat, m.lng))
      .filter((coord): coord is ValidCoordinates => !!coord);
    const aCoords = agendamentos
      .map(a => normalizeCoordinatePair(a.lat, a.lng))
      .filter((coord): coord is ValidCoordinates => !!coord);
    const all = [...vCoords, ...aCoords];
    if (all.length === 0) return;
    if (all.length === 1) {
      mapRef.current?.animateToRegion({
        latitude: all[0].latitude, longitude: all[0].longitude,
        latitudeDelta: 0.008, longitudeDelta: 0.008,
      }, 800);
      return;
    }
    (mapRef.current as any)?.fitToCoordinates(all, {
      edgePadding: { top: 160, right: 50, bottom: 220, left: 50 }, animated: true,
    });
  };

  const refreshMarkerRendering = () => {
    setTracksMarkerChanges(true);
    if (markerRenderTimerRef.current) clearTimeout(markerRenderTimerRef.current);
    markerRenderTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setTracksMarkerChanges(false);
    }, 1400);
  };

  useFocusEffect(useCallback(() => {
    mountedRef.current = true;
    setMapVisible(true);
    refreshMarkerRendering();
    return () => {
      clearMapTimers();
      setSelectedMarker(null);
      setSelectedAgendamento(null);
      setTracksMarkerChanges(false);
      setMapVisible(false);
      currentRegionRef.current = null;
    };
  }, [clearMapTimers]));

  const loadMarkers = async () => {
    if (!profile) {
      setMarkers([]);
      setAgendamentos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshMarkerRendering();
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
          if (!mountedRef.current) return;
          const loaded: VistoriaMarker[] = data
            .filter((v: any) => hasValidCoordinates(v.latitude, v.longitude))
            .map((v: any) => ({
              id: v.id,
              lat: Number(v.latitude),
              lng: Number(v.longitude),
              nivelRisco: v.nivelRisco || 'r1',
              endereco: v.endereco || 'Endereço não informado',
              agenteNome: v.agenteNome || '—',
              dataVistoria: v.dataVistoria,
              pontuacaoTotal: v.pontuacaoTotal,
            }));
          setMarkers(loaded);

          // Carregar agendamentos pendentes com coordenadas
          let loadedAgend: AgendamentoMarker[] = [];
          try {
            let agendQuery = supabase
              .from('agendamentos')
              .select('id, titulo, endereco, data_agendada, agente_nome, status, lat, lng')
              .eq('status', 'pendente')
              .not('lat', 'is', null)
              .not('lng', 'is', null);
            if (!isAdmin) {
              // Agente vê agendamentos atribuídos a ele OU sem atribuição no seu município
              agendQuery = agendQuery
                .or(`agente_uid.eq.${profile.uid},agente_uid.is.null`)
                .eq('municipio', profile.municipio);
            } else if (profile.municipio && profile.role !== 'master_admin') {
              agendQuery = agendQuery.eq('municipio', profile.municipio);
            }
            const { data: agendData } = await agendQuery.limit(200);
            if (agendData) {
              loadedAgend = agendData.filter((a: any) => hasValidCoordinates(a.lat, a.lng)).map((a: any) => ({
                id: a.id,
                lat: Number(a.lat),
                lng: Number(a.lng),
                titulo: a.titulo,
                endereco: a.endereco || '',
                dataAgendada: a.data_agendada,
                agenteNome: a.agente_nome || 'Sem atribuição',
                status: a.status,
              }));
              setAgendamentos(loadedAgend);
            }
          } catch { /* agendamentos opcionais */ }

          if (!mountedRef.current) return;
          // Considera vistorias e agendamentos para o enquadramento inicial
          const allPoints = [
            ...loaded.map(m => ({ lat: m.lat, lng: m.lng })),
            ...loadedAgend.map(a => ({ lat: a.lat, lng: a.lng })),
          ];
          if (allPoints.length > 0) {
            if (isInitialLoadRef.current) {
              // Carga inicial: anima para o centróide com zoom de bairro fixo
              isInitialLoadRef.current = false;
              timer1Ref.current = setTimeout(() => {
                if (!mountedRef.current) return;
                const centLat = allPoints.reduce((s, m) => s + m.lat, 0) / allPoints.length;
                const centLng = allPoints.reduce((s, m) => s + m.lng, 0) / allPoints.length;
                mapRef.current?.animateToRegion({
                  latitude: centLat,
                  longitude: centLng,
                  latitudeDelta: 0.06,
                  longitudeDelta: 0.06,
                }, 800);
              }, 1200);
            } else {
              // Refresh manual: micro-jiggle para forçar recálculo visual do mapa.
              timer1Ref.current = setTimeout(() => {
                if (!mountedRef.current) return;
                const r = currentRegionRef.current;
                if (r && normalizeCoordinatePair(r.latitude, r.longitude)) {
                  mapRef.current?.animateToRegion(
                    { ...r, latitude: r.latitude + 0.0002 }, 80
                  );
                  timer2Ref.current = setTimeout(() => {
                    if (!mountedRef.current) return;
                    mapRef.current?.animateToRegion(r, 80);
                  }, 200);
                }
              }, 300);
            }
          }
          return;
        }
      }

      // Offline: SQLite
      const locais = profile.role === 'master_admin'
        ? getAllVistorias()
        : isAdmin
          ? getVistoriasByMunicipio(profile.municipio)
          : getVistoriasByAgente(profile.uid);

      const offlineMarkers: VistoriaMarker[] = locais
        .filter((v: any) => hasValidCoordinates(v.latitude, v.longitude))
        .map((v: any) => ({
          id: v.id,
          lat: Number(v.latitude),
          lng: Number(v.longitude),
          nivelRisco: v.nivel_risco || 'r1',
          endereco: `${v.endereco_rua || ''}, ${v.endereco_numero || ''} - ${v.endereco_bairro || ''}`,
          agenteNome: v.agente_nome || '—',
          dataVistoria: v.data_vistoria,
          pontuacaoTotal: v.pontuacao_total,
        }));
      setMarkers(offlineMarkers);

      // Agendamentos offline (SQLite) — master_admin vê tudo; status pendente apenas
      const agendLocais = profile.role === 'master_admin'
        ? getAllAgendamentos()
        : isAdmin
          ? getAgendamentosByMunicipio(profile.municipio ?? '')
          : getAgendamentosByAgente(profile.uid, profile.municipio);
      const offlineAgend: AgendamentoMarker[] = agendLocais
        .filter((a: any) => hasValidCoordinates(a.lat, a.lng) && a.status === 'pendente')
        .map((a: any) => ({
          id: a.id,
          lat: Number(a.lat),
          lng: Number(a.lng),
          titulo: a.titulo,
          endereco: a.endereco || '',
          dataAgendada: a.data_agendada,
          agenteNome: a.agente_nome || 'Sem atribuição',
          status: a.status,
        }));
      setAgendamentos(offlineAgend);

      // Enquadramento inicial offline
      if (isInitialLoadRef.current) {
        const offlinePoints = [
          ...offlineMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
          ...offlineAgend.map(a => ({ lat: a.lat, lng: a.lng })),
        ];
        if (offlinePoints.length > 0) {
          isInitialLoadRef.current = false;
          timer1Ref.current = setTimeout(() => {
            if (!mountedRef.current) return;
            const centLat = offlinePoints.reduce((s, m) => s + m.lat, 0) / offlinePoints.length;
            const centLng = offlinePoints.reduce((s, m) => s + m.lng, 0) / offlinePoints.length;
            mapRef.current?.animateToRegion({
              latitude: centLat, longitude: centLng,
              latitudeDelta: 0.06, longitudeDelta: 0.06,
            }, 800);
          }, 1200);
        }
      }
    } catch (e) {
      logger.error('vistoria', 'Erro ao carregar marcadores do mapa', { erro: String(e) });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const filteredMarkers = markers.filter(m => {
    const n = normalizeNivel(m.nivelRisco);
    if (filter === 'alto'  && !(n === 'r3' || n === 'r4')) return false;
    if (filter === 'medio' && n !== 'r2') return false;
    if (filter === 'baixo' && n !== 'r1') return false;
    if (filtroPeriodo !== 'todos' && m.dataVistoria) {
      const dias = filtroPeriodo === '7d' ? 7 : 30;
      if (new Date(m.dataVistoria) < new Date(Date.now() - dias * 86400000)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (filteredMarkers.length === 0 && agendamentos.length === 0) return;
    refreshMarkerRendering();
  }, [filteredMarkers.length, agendamentos.length, filter, filtroPeriodo, showHeatmap]);

  const currentStyleConfig = MAP_STYLES.find(s => s.key === mapStyle)!;
  const initialRegion = userLocation
    ? { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: -15.7801, longitude: -47.9292, latitudeDelta: 30, longitudeDelta: 30 };

  const heatmapPoints = filteredMarkers.map(m => {
    const n = normalizeNivel(m.nivelRisco);
    return {
      latitude: m.lat, longitude: m.lng,
      weight: n === 'r4' ? 1 : n === 'r3' ? 0.8 : n === 'r2' ? 0.5 : 0.3,
    };
  });
  const shouldRenderPins = !showHeatmap || Platform.OS !== 'android';
  const topInset = insets.top || (Platform.OS === 'android' ? 28 : 44);
  const filtersTop = topInset + (Platform.OS === 'android' ? 88 : 78);

  if (loading) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Carregando mapa...</Text>
      </View>
    );
  }

  if (!isOnlineReal && filteredMarkers.length === 0 && agendamentos.length === 0) {
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
      {mapVisible && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          mapType={currentStyleConfig.mapType}
          customMapStyle={mapStyle === 'escuro' ? DARK_MAP_STYLE : undefined}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={(region: any) => {
            if (!mountedRef.current) return;
            if (!normalizeCoordinatePair(region?.latitude, region?.longitude)) return;
            currentRegionRef.current = region;
          }}
        >
          {shouldRenderPins && filteredMarkers.map(m => (
            USE_NATIVE_ANDROID_MARKERS ? (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.lat, longitude: m.lng }}
                onPress={() => { setSelectedAgendamento(null); setSelectedMarker(m); }}
                pinColor={getRiscoColor(m.nivelRisco)}
                title={getRiscoLabel(m.nivelRisco)}
                description={m.endereco}
              />
            ) : (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.lat, longitude: m.lng }}
                onPress={() => { setSelectedAgendamento(null); setSelectedMarker(m); }}
                anchor={MARKER_ANCHOR}
                centerOffset={MARKER_CENTER_OFFSET}
                tracksViewChanges={tracksMarkerChanges}
              >
                <MarkerPin color={getRiscoColor(m.nivelRisco)} label={getRiscoShortLabel(m.nivelRisco)} />
              </Marker>
            )
          ))}

          {agendamentos.map(a => (
            USE_NATIVE_ANDROID_MARKERS ? (
              <Marker
                key={`agend-${a.id}`}
                coordinate={{ latitude: a.lat, longitude: a.lng }}
                onPress={() => { setSelectedMarker(null); setSelectedAgendamento(a); }}
                pinColor="#3B82F6"
                title="Agendamento"
                description={a.titulo}
              />
            ) : (
              <Marker
                key={`agend-${a.id}`}
                coordinate={{ latitude: a.lat, longitude: a.lng }}
                onPress={() => { setSelectedMarker(null); setSelectedAgendamento(a); }}
                anchor={MARKER_ANCHOR}
                centerOffset={MARKER_CENTER_OFFSET}
                tracksViewChanges={tracksMarkerChanges}
              >
                <AgendamentoPin />
              </Marker>
            )
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
        </MapView>
      )}

      {/* Header flutuante */}
      <View style={[styles.headerOverlay, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          style={[styles.floatBtn, { backgroundColor: theme.surfaceHighlight }]}
          onPress={() => safeBack('/(panel)/dashboard')}
        >
          <Feather name="arrow-left" color={theme.text} size={20} />
        </TouchableOpacity>

        <View style={[styles.headerInfo, { backgroundColor: theme.surfaceHighlight }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Mapa Tático</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            {filteredMarkers.length} vistoria{filteredMarkers.length !== 1 ? 's' : ''}
            {agendamentos.length > 0 ? ` · ${agendamentos.length} agendado${agendamentos.length !== 1 ? 's' : ''}` : ''}
            {!isOnlineReal ? ' · offline' : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.floatBtn, { backgroundColor: theme.surfaceHighlight }]}
          onPress={goToUserLocation}
        >
          <Feather name="navigation" color={theme.primary} size={18} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.floatBtn, { backgroundColor: theme.surfaceHighlight }]}
          onPress={loadMarkers}
        >
          <Feather name="refresh-cw" color={theme.text} size={18} />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={[styles.filtersOverlay, { top: filtersTop }]}>
        <View style={[styles.filterRail, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.chip,
                  filter === f.key
                    ? { backgroundColor: f.color }
                    : { backgroundColor: 'transparent' },
                ]}
                onPress={() => setFilter(f.key)}
              >
                <View style={styles.chipInner}>
                  {f.key !== 'todos' && (
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: filter === f.key ? '#FFF' : f.color,
                    }} />
                  )}
                  <Text style={[styles.chipText, { color: filter === f.key ? '#FFF' : theme.text }]}>
                    {f.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={[styles.filterDivider, { backgroundColor: theme.border }]} />

            {PERIODOS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.chip,
                  filtroPeriodo === p.key
                    ? { backgroundColor: theme.primary }
                    : { backgroundColor: 'transparent' },
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
      </View>

      {/* FABs direita */}
      <View style={[styles.fabGroup, { bottom: bottomNavH + 12 }]}>
        {(filteredMarkers.length > 0 || agendamentos.length > 0) && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: theme.surfaceHighlight }]}
            onPress={() => fitToMarkers()}
          >
            <Feather name="maximize-2" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: showHeatmap ? theme.primary : theme.surfaceHighlight }]}
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

      {/* Popup de agendamento selecionado */}
      {selectedAgendamento && (
        <View style={[styles.markerPopup, { backgroundColor: theme.surfaceHighlight, bottom: bottomNavH + 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={[styles.riscoBadge, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.riscoBadgeText}>AGENDADO</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedAgendamento(null)} style={{ marginLeft: 'auto' }}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.popupEndereco, { color: theme.text }]} numberOfLines={2}>
            {selectedAgendamento.titulo}
          </Text>
          <Text style={[styles.popupAgente, { color: theme.textSecondary }]}>
            {selectedAgendamento.agenteNome} · {new Date(selectedAgendamento.dataAgendada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.popupActions}>
            <TouchableOpacity
              style={[styles.popupBtn, { backgroundColor: '#EFF6FF', flex: 1 }]}
              onPress={() => { setSelectedAgendamento(null); router.push(`/(panel)/agendamentos/${selectedAgendamento.id}`); }}
            >
              <Text style={{ color: '#3B82F6', fontSize: 13, fontWeight: '700' }}>Ver agendamento →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.popupBtn, styles.popupRotaBtn, { backgroundColor: `${theme.primary}15`, flex: 1 }]}
              onPress={() => tracarRota(selectedAgendamento.lat, selectedAgendamento.lng)}
            >
              <Feather name="navigation" size={14} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700', marginLeft: 5 }}>Traçar Rota</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Popup do marcador selecionado */}
      {selectedMarker && (
        <View style={[styles.markerPopup, { backgroundColor: theme.surfaceHighlight, bottom: bottomNavH + 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={[styles.riscoBadge, { backgroundColor: getRiscoColor(selectedMarker.nivelRisco) }]}>
              <Text style={styles.riscoBadgeText}>{getRiscoLabel(selectedMarker.nivelRisco)}</Text>
            </View>
            {selectedMarker.pontuacaoTotal != null && (
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>{selectedMarker.pontuacaoTotal}pts</Text>
            )}
            <TouchableOpacity onPress={() => setSelectedMarker(null)} style={{ marginLeft: 'auto' }}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.popupEndereco, { color: theme.text }]} numberOfLines={2}>
            {selectedMarker.endereco}
          </Text>
          <Text style={[styles.popupAgente, { color: theme.textSecondary }]}>
            {selectedMarker.agenteNome} · {selectedMarker.dataVistoria
              ? new Date(selectedMarker.dataVistoria).toLocaleDateString('pt-BR')
              : '—'}
          </Text>
          <View style={styles.popupActions}>
            <TouchableOpacity
              style={[styles.popupBtn, { backgroundColor: '#EFF6FF', flex: 1 }]}
              onPress={() => { setSelectedMarker(null); router.push(`/(panel)/inspecoes/${selectedMarker.id}`); }}
            >
              <Text style={{ color: '#3B82F6', fontSize: 13, fontWeight: '700' }}>Ver detalhes →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.popupBtn, styles.popupRotaBtn, { backgroundColor: `${theme.primary}15`, flex: 1 }]}
              onPress={() => tracarRota(selectedMarker.lat, selectedMarker.lng)}
            >
              <Feather name="navigation" size={14} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700', marginLeft: 5 }}>Traçar Rota</Text>
            </TouchableOpacity>
          </View>
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
        <View style={[styles.sheet, { backgroundColor: theme.surfaceHighlight, paddingBottom: insets.bottom + 8 }]}>
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
                <Text style={[styles.styleDesc,  { color: theme.textSecondary }]}>{s.desc}</Text>
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
    paddingBottom: 8, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  floatBtn: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 5, elevation: 4,
  },
  headerInfo: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 5, elevation: 4,
  },
  headerTitle: { fontSize: 15, fontWeight: '800' },
  headerSub:   { fontSize: 11, fontWeight: '500', marginTop: 1 },

  filtersOverlay: { position: 'absolute', top: 118, left: 0, right: 0, paddingHorizontal: 12 },
  filterRail: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 5,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  filtersContent: {
    alignItems: 'center',
    gap: 4,
    paddingRight: 10,
  },
  chip: {
    minHeight: 32,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontSize: 12, fontWeight: '800' },
  filterDivider: { width: 1, height: 22, alignSelf: 'center', marginHorizontal: 4 },

  fabGroup: { position: 'absolute', right: 16, bottom: 80 },
  fab: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
    marginBottom: 10,
  },

  markerPopup: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  riscoBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  riscoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  popupEndereco:  { fontSize: 14, fontWeight: '600', marginBottom: 4, lineHeight: 20 },
  popupAgente:    { fontSize: 12, marginBottom: 10 },
  popupActions:   { flexDirection: 'row', gap: 8 },
  popupBtn:       { borderRadius: 10, padding: 10, alignItems: 'center' },
  popupRotaBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  styleRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
  },
  styleIcon:  { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  styleLabel: { fontSize: 15, fontWeight: '700' },
  styleDesc:  { fontSize: 12, marginTop: 2 },
});
