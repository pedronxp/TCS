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
  latitude: number | null;
  longitude: number | null;
}

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
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const located = useMemo(
    () => points.filter((point): point is PortalMapPoint & { latitude: number; longitude: number } =>
      typeof point.latitude === 'number' && typeof point.longitude === 'number'),
    [points],
  );

  useEffect(() => {
    if (!container.current || located.length === 0) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: rasterStyle,
      center: [located[0].longitude, located[0].latitude],
      zoom: 12,
      attributionControl: false,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    const bounds = new maplibregl.LngLatBounds();
    const markers = located.map((point) => {
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('p');
      title.textContent = point.protocol;
      detail.textContent = `${point.status} · ${point.address}`;
      popup.append(title, detail);
      bounds.extend([point.longitude, point.latitude]);
      return new maplibregl.Marker({ color: '#2F708E', scale: 0.85 })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(popup))
        .addTo(instance);
    });
    instance.once('load', () => {
      if (located.length > 1) instance.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
      setReady(true);
      setFailed(false);
    });
    instance.on('error', () => setFailed(true));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      markers.forEach((marker) => marker.remove());
      instance.remove();
      map.current = null;
    };
  }, [located]);

  function fit() {
    if (!map.current || located.length === 0) return;
    const bounds = located.reduce(
      (next, point) => next.extend([point.longitude, point.latitude]),
      new maplibregl.LngLatBounds(),
    );
    map.current.fitBounds(bounds, { padding: 64, maxZoom: 15 });
  }

  if (located.length === 0) {
    return <div className="grid min-h-80 place-items-center rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma vistoria com coordenadas neste escopo.</div>;
  }
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Mapa de vistorias">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-success-soft text-primary"><Layers3 className="h-4 w-4" /></span><div><p className="text-sm font-semibold">Cobertura territorial</p><p className="text-xs text-muted-foreground">{located.length} pontos autorizados</p></div></div>
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
