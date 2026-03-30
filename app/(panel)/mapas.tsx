import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
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

const MAP_STYLES: { key: MapStyle; label: string; icon: string; desc: string; tileUrl: string; subdomains?: string }[] = [
  {
    key: 'padrao',
    label: 'Padrão',
    icon: 'map',
    desc: 'Ruas e estradas',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
  },
  {
    key: 'satelite',
    label: 'Satélite',
    icon: 'globe',
    desc: 'Imagem aérea — Esri',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
  {
    key: 'relevo',
    label: 'Relevo',
    icon: 'triangle',
    desc: 'Topografia — Esri',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  },
  {
    key: 'escuro',
    label: 'Escuro',
    icon: 'moon',
    desc: 'Modo noturno',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
  },
];

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'todos', label: 'Todos',  color: '#3B82F6' },
  { key: 'alto',  label: 'Alto',   color: '#EF4444' },
  { key: 'medio', label: 'Médio',  color: '#F59E0B' },
  { key: 'baixo', label: 'Baixo',  color: '#10B981' },
];

function getRiscoColor(nivel: string) {
  if (nivel === 'r4') return '#EF4444';
  if (nivel === 'r3') return '#F97316';
  if (nivel === 'r2') return '#F59E0B';
  return '#10B981';
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildHtml(
  markers: VistoriaMarker[],
  userLat: number | null,
  userLng: number | null,
  style: MapStyle,
  showHeatmap: boolean,
): string {
  const s = MAP_STYLES.find(m => m.key === style)!;
  // safeStr: escapa HTML + caracteres especiais JS para injeção segura em strings JS single-quoted
  const safeStr = (v: string) => escapeHtml(v).replace(/\n/g, ' ');

  const pinSvg = (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='40' viewBox='0 0 30 40'>`
    + `<filter id='s'><feDropShadow dx='0' dy='2' stdDeviation='2' flood-opacity='0.3'/></filter>`
    + `<g filter='url(#s)'>`
    + `<path d='M15 2C8 2 2 8 2 15C2 24 15 38 15 38C15 38 28 24 28 15C28 8 22 2 15 2Z' fill='${color}' stroke='white' stroke-width='2'/>`
    + `<circle cx='15' cy='15' r='6' fill='white' opacity='0.9'/>`
    + `</g></svg>`;

  const markersJs = markers.map(m => {
    const color = getRiscoColor(m.nivelRisco);
    const svgEnc = encodeURIComponent(pinSvg(color));
    const label = m.nivelRisco === 'r4' ? 'CRÍTICO' : m.nivelRisco === 'r3' ? 'ALTO' : m.nivelRisco === 'r2' ? 'MÉDIO' : 'BAIXO';
    const pts = m.pontuacaoTotal != null ? ` · ${m.pontuacaoTotal}pts` : '';
    const data = m.dataVistoria ? new Date(m.dataVistoria).toLocaleDateString('pt-BR') : '—';
    const popup = `<div style='font-family:-apple-system,sans-serif;min-width:200px;padding:4px'>`
      + `<div style='display:flex;align-items:center;gap:8px;margin-bottom:8px'>`
      + `<span style='background:${color};color:#fff;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:800'>${label}${pts}</span>`
      + `</div>`
      + `<div style='font-size:13px;font-weight:600;color:#111;margin-bottom:6px;line-height:1.4'>${safeStr(m.endereco)}</div>`
      + `<div style='font-size:11px;color:#888;margin-bottom:10px'>${safeStr(m.agenteNome)} · ${data}</div>`
      + `<button onclick="window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'tap',id:'${m.id}'}))"`
      + ` style='width:100%;background:#EFF6FF;color:#3B82F6;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:700;cursor:pointer'>`
      + `Ver detalhes →</button>`
      + `</div>`;
    return `(function(){
      var icon=L.icon({iconUrl:'data:image/svg+xml;charset=UTF-8,${svgEnc}',iconSize:[30,40],iconAnchor:[15,38],popupAnchor:[0,-40]});
      clusterGroup.addLayer(L.marker([${m.lat},${m.lng}],{icon:icon}).bindPopup('${safeStr(popup)}',{maxWidth:240,closeButton:false}));
      bounds.push([${m.lat},${m.lng}]);
    })();`;
  }).join('\n');

  const userSvg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'>`
    + `<circle cx='11' cy='11' r='9' fill='#3B82F6' stroke='white' stroke-width='2.5'/>`
    + `<circle cx='11' cy='11' r='4' fill='white'/></svg>`
  );
  const userJs = (userLat && userLng)
    ? `(function(){var ui=L.icon({iconUrl:'data:image/svg+xml;charset=UTF-8,${userSvg}',iconSize:[22,22],iconAnchor:[11,11],popupAnchor:[0,-12]});L.marker([${userLat},${userLng}],{icon:ui}).addTo(map).bindPopup('<b>Você está aqui</b>');bounds.push([${userLat},${userLng}]);})();`
    : '';

  const initView = (userLat && userLng) ? `[${userLat},${userLng}],14` : `[-15.7801,-47.9292],5`;
  const bgColor = style === 'escuro' ? '#0B0F19' : '#E8EDF2';
  const subdomainsAttr = s.subdomains ? `subdomains:'${s.subdomains}',` : '';

  const heatPoints = markers.map(m => `[${m.lat},${m.lng},0.8]`).join(',');
  const heatJs = showHeatmap
    ? `if(typeof L.heatLayer!=='undefined'){L.heatLayer([${heatPoints}],{radius:28,blur:18,maxZoom:16}).addTo(map);}`
    : '';

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:${bgColor}}
#map{width:100%;height:100%;background:${bgColor}}
#map-error{display:none;position:absolute;inset:0;background:${bgColor};justify-content:center;align-items:center;flex-direction:column;font-family:-apple-system,sans-serif;text-align:center;padding:32px;gap:12px}
.leaflet-popup-content-wrapper{border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.18);border:none;padding:0}
.leaflet-popup-content{margin:14px 16px}
.leaflet-popup-tip-container{display:none}
.leaflet-control-attribution{display:none!important}
.leaflet-control-zoom{border:none!important;box-shadow:0 4px 12px rgba(0,0,0,0.15)!important;border-radius:12px!important;overflow:hidden}
.leaflet-control-zoom a{font-size:18px!important;width:38px!important;height:38px!important;line-height:38px!important;border-radius:0!important}
.marker-cluster-small{background-color:rgba(59,130,246,0.4)}.marker-cluster-small div{background-color:rgba(59,130,246,0.8)}
.marker-cluster-medium{background-color:rgba(245,158,11,0.4)}.marker-cluster-medium div{background-color:rgba(245,158,11,0.8)}
.marker-cluster-large{background-color:rgba(239,68,68,0.4)}.marker-cluster-large div{background-color:rgba(239,68,68,0.8)}
.marker-cluster div{width:30px;height:30px;margin-left:5px;margin-top:5px;text-align:center;border-radius:15px;font:bold 12px sans-serif;color:white;line-height:30px}
.marker-cluster{width:40px;height:40px;border-radius:20px}
</style></head><body>
<div id="map"></div>
<div id="map-error">
  <div style="font-size:40px">🗺️</div>
  <div style="font-size:16px;font-weight:700;color:#374151">Mapa indisponível</div>
  <div style="font-size:13px;color:#6B7280;line-height:1.5" id="map-error-msg">Verifique sua conexão com a internet e tente novamente.</div>
  <button onclick="location.reload()" style="margin-top:8px;background:#3B82F6;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer">Tentar novamente</button>
</div>
<script>
function showError(msg){
  var el=document.getElementById('map-error');
  if(el){el.style.display='flex';if(msg)document.getElementById('map-error-msg').textContent=msg;}
}
window.onerror=function(msg,src,line,col,err){
  showError('Erro ao inicializar o mapa. Verifique sua conexão.');
  return true;
};
// Carrega scripts do Leaflet dinamicamente para detectar falhas
var scriptsToLoad=[
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'
];
var loaded=0;
var failed=false;
function loadNextScript(idx){
  if(idx>=scriptsToLoad.length){initMap();return;}
  var s=document.createElement('script');
  s.src=scriptsToLoad[idx];
  s.onload=function(){loaded++;loadNextScript(idx+1);};
  s.onerror=function(){
    if(!failed){failed=true;showError('Não foi possível carregar o mapa. Verifique sua conexão com a internet.');}
  };
  document.head.appendChild(s);
}
function initMap(){
  if(typeof L==='undefined'){showError('Biblioteca de mapas não disponível. Verifique sua conexão.');return;}
  try{
    var map=L.map('map',{zoomControl:true,zoomAnimation:true}).setView(${initView});
    L.tileLayer('${s.tileUrl}',{maxZoom:20,${subdomainsAttr}attribution:''}).addTo(map);
    var bounds=[];
    var clusterGroup;
    try{
      clusterGroup=L.markerClusterGroup({maxClusterRadius:60,showCoverageOnHover:false,zoomToBoundsOnClick:true});
    }catch(e){
      clusterGroup={addLayer:function(layer){layer.addTo(map);}};
    }
    ${markersJs}
    if(clusterGroup.addTo){clusterGroup.addTo(map);}
    ${userJs}
    ${heatJs}
    if(bounds.length>0){try{map.fitBounds(L.latLngBounds(bounds).pad(0.15),{maxZoom:15,animate:true});}catch(e){}}
    // Notifica RN que o mapa carregou
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapReady'}));}
  }catch(e){
    showError('Erro ao renderizar o mapa: '+e.message);
  }
}
loadNextScript(0);
</script></body></html>`;
}

export default function MapasScreen() {
  const { theme } = useTheme();
  const { isOnlineReal } = useConnectivity();
  const { profile } = useAuth();
  const webviewRef = useRef<WebView>(null);

  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<VistoriaMarker[]>([]);
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FilterPeriodo>('todos');
  const [mapStyle, setMapStyle] = useState<MapStyle>('padrao');
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
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
    // Filtro de risco
    if (filter === 'alto' && !(m.nivelRisco === 'r3' || m.nivelRisco === 'r4')) return false;
    if (filter === 'medio' && m.nivelRisco !== 'r2') return false;
    if (filter === 'baixo' && m.nivelRisco !== 'r1') return false;
    // Filtro de período
    if (filtroPeriodo !== 'todos' && m.dataVistoria) {
      const dias = filtroPeriodo === '7d' ? 7 : 30;
      const desde = new Date(Date.now() - dias * 86400000);
      if (new Date(m.dataVistoria) < desde) return false;
    }
    return true;
  });

  const html = buildHtml(
    filteredMarkers,
    userLocation?.lat ?? null,
    userLocation?.lng ?? null,
    mapStyle,
    showHeatmap,
  );

  const currentStyle = MAP_STYLES.find(s => s.key === mapStyle)!;

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'tap' && msg.id) {
        router.push(`/(panel)/inspecoes/${msg.id}`);
      }
    } catch { }
  };

  return (
    <View style={styles.container}>
      {/* Mapa */}
      {loading ? (
        <View style={[styles.fullCenter, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Carregando mapa...</Text>
        </View>
      ) : !isOnlineReal && filteredMarkers.length === 0 ? (
        <View style={[styles.fullCenter, { backgroundColor: theme.background }]}>
          <Feather name="wifi-off" size={48} color={theme.border} />
          <Text style={[styles.loadingText, { color: theme.textSecondary, textAlign: 'center' }]}>
            Sem conexão e nenhuma vistoria local.{'\n'}Reconecte para carregar.
          </Text>
        </View>
      ) : Platform.OS === 'ios' ? (
        <View style={[styles.fullCenter, { backgroundColor: theme.background }]}>
          <Feather name="map" size={48} color={theme.border} />
          <Text style={[styles.loadingText, { color: theme.text, fontWeight: '700', fontSize: 16 }]}>
            Mapa indisponível no iOS
          </Text>
          <Text style={[styles.loadingText, { color: theme.textSecondary, textAlign: 'center', marginTop: -8 }]}>
            Este recurso está disponível{'\n'}apenas na versão Android.
          </Text>
        </View>
      ) : (
        <WebView
          key={`${mapStyle}-${filter}-${filtroPeriodo}-${showHeatmap}`}
          ref={webviewRef}
          source={{ html, baseUrl: 'https://localhost' }}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: mapStyle === 'escuro' ? '#0B0F19' : '#E8EDF2' }]}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: mapStyle === 'escuro' ? '#0B0F19' : '#E8EDF2' }]}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          )}
          onMessage={handleMessage}
          onError={(e) => logger.warn('system', 'WebView erro no mapa', { desc: e.nativeEvent.description })}
          onHttpError={(e) => logger.warn('system', 'WebView HTTP erro no mapa', { status: e.nativeEvent.statusCode })}
        />
      )}

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

      {/* Filtros flutuantes — risco */}
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
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: showHeatmap ? theme.primary : theme.surfaceHighlight, marginBottom: 10 }]}
          onPress={() => setShowHeatmap(h => !h)}
        >
          <Feather name="zap" size={20} color={showHeatmap ? '#FFF' : theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.surfaceHighlight }]}
          onPress={() => setShowStyleModal(true)}
        >
          <Feather name={currentStyle.icon as any} size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Legenda rodapé */}
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

      {/* Modal tipo de mapa */}
      <Modal
        visible={showStyleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStyleModal(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowStyleModal(false)}
        />
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
  container: { flex: 1, backgroundColor: '#E8EDF2' },

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
    position: 'absolute', top: 118, left: 0, right: 0,
    paddingHorizontal: 16,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  fabGroup: {
    position: 'absolute', right: 16, bottom: 150,
  },
  fab: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
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

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingTop: 12, gap: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  styleRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
  },
  styleIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  styleLabel: { fontSize: 15, fontWeight: '700' },
  styleDesc: { fontSize: 12, marginTop: 2 },
});
