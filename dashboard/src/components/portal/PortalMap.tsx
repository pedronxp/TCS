import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers3, MapPin, Maximize2 } from 'lucide-react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '@/components/ui/Button';

export interface PortalMapPoint {
  id: string;
  protocol: string;
  status: string;
  address: string;
  formularioId: string | null;
  latitude: number | null;
  longitude: number | null;
}

type LocatedPortalMapPoint = PortalMapPoint & { latitude: number; longitude: number };
type MarkerEntry = { marker: maplibregl.Marker; signature: string };

const rasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'openstreetmap', type: 'raster', source: 'openstreetmap' }],
};

export function PortalMap({ points }: { points: PortalMapPoint[] }) {
  const located = useMemo(
    () => points.filter((point): point is LocatedPortalMapPoint =>
      typeof point.latitude === 'number'
      && Number.isFinite(point.latitude)
      && point.latitude >= -90
      && point.latitude <= 90
      && typeof point.longitude === 'number'
      && Number.isFinite(point.longitude)
      && point.longitude >= -180
      && point.longitude <= 180),
    [points],
  );

  if (located.length === 0) {
    return <div className="grid min-h-80 place-items-center rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma vistoria com coordenadas neste escopo.</div>;
  }
  return <PortalMapCanvas points={located} />;
}

function PortalMapCanvas({ points }: { points: LocatedPortalMapPoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());
  const latestPoints = useRef(points);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    latestPoints.current = points;
  }, [points]);

  useEffect(() => {
    if (!container.current) return;
    const firstPoint = latestPoints.current[0];
    const instance = new maplibregl.Map({
      container: container.current,
      style: rasterStyle,
      center: [firstPoint.longitude, firstPoint.latitude],
      zoom: 12,
      attributionControl: false,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    instance.once('load', () => {
      fitMapToPoints(instance, latestPoints.current);
      setReady(true);
      setFailed(false);
    });
    instance.on('error', () => setFailed(true));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    const markerEntries = markers.current;
    return () => {
      observer.disconnect();
      markerEntries.forEach(({ marker }) => marker.remove());
      markerEntries.clear();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const visibleIds = new Set(points.map((point) => point.id));
    markers.current.forEach(({ marker }, id) => {
      if (visibleIds.has(id)) return;
      marker.remove();
      markers.current.delete(id);
    });
    points.forEach((point) => {
      const signature = markerSignature(point);
      const current = markers.current.get(point.id);
      if (current?.signature === signature) return;
      current?.marker.remove();
      markers.current.set(point.id, {
        marker: createMarker(point).addTo(instance),
        signature,
      });
    });
  }, [points]);

  function fit() {
    if (!map.current) return;
    fitMapToPoints(map.current, points);
  }
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Mapa de vistorias">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-success-soft text-primary"><Layers3 className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-sm font-semibold">Cobertura territorial</p><p className="text-xs text-muted-foreground">{points.length} pontos autorizados</p></div></div>
        <Button variant="outline" size="sm" className="min-h-11" onClick={fit}><Maximize2 />Enquadrar</Button>
      </header>
      <div className="relative">
        <div ref={container} className="portal-map h-[520px] min-h-[360px] w-full bg-secondary" data-map-ready={ready} />
        {!ready && !failed && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/60"><span className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">Carregando mapa…</span></div>}
        {failed && <p className="absolute inset-x-4 top-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning">O mapa-base não respondeu. Use a lista textual abaixo.</p>}
        <p className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs"><MapPin className="h-4 w-4 text-primary" />Selecione um marcador para detalhes</p>
      </div>
    </section>
  );
}

function createMarker(point: LocatedPortalMapPoint) {
  const popup = document.createElement('div');
  const title = document.createElement('strong');
  const detail = document.createElement('p');
  title.textContent = point.protocol;
  detail.textContent = `${point.status} · ${point.address}`;
  popup.append(title, detail);
  const symbol = getPortalFormMarkerSymbol(point.formularioId);
  const element = symbol ? createFormMarkerElement(symbol) : undefined;
  return new maplibregl.Marker(element ? { element } : { color: '#2F708E', scale: 0.85 })
    .setLngLat([point.longitude, point.latitude])
    .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(popup));
}

function markerSignature(point: LocatedPortalMapPoint) {
  return [point.latitude, point.longitude, point.protocol, point.status, point.address, point.formularioId].join('|');
}

export function getPortalFormMarkerSymbol(formularioId: string | null | undefined) {
  switch (formularioId) {
    case 'inspecao_bueiro_drenagem_v1': return '▦';
    case 'risco_incendio_vegetacao_v1': return '🔥';
    case 'risco_inundacao_v1': return '💧';
    case 'avaliacao_arvore_cbmmg_v1': return '♣';
    default: return null;
  }
}

function createFormMarkerElement(symbol: string) {
  const element = document.createElement('span');
  element.className = 'grid h-9 w-9 place-items-center rounded-full border-2 border-primary bg-card text-lg shadow-md';
  element.textContent = symbol;
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function fitMapToPoints(instance: maplibregl.Map, points: LocatedPortalMapPoint[]) {
  if (points.length === 1) {
    instance.jumpTo({ center: [points[0].longitude, points[0].latitude], zoom: 12 });
    return;
  }
  const bounds = points.reduce(
    (next, point) => next.extend([point.longitude, point.latitude]),
    new maplibregl.LngLatBounds(),
  );
  instance.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
}
