import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers3, MapPin, Maximize2 } from 'lucide-react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CustomerMapPoint } from '@/types/domain';
import { Button } from '@/components/ui/Button';

const rasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'openstreetmap', type: 'raster', source: 'openstreetmap', minzoom: 0, maxzoom: 22 }],
};

type LocatedPoint = CustomerMapPoint & { latitude: number; longitude: number };

export function CustomerMap({ points }: { points: CustomerMapPoint[] }) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const located = useMemo(
    () => points.filter(
      (point): point is LocatedPoint => typeof point.latitude === 'number'
        && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
        && typeof point.longitude === 'number'
        && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180,
    ),
    [points],
  );
  const hasLocated = located.length > 0;

  useEffect(() => {
    if (!node.current || !hasLocated || mapRef.current) return;
    const firstPoint = located[0];
    const markers = markersRef.current;
    const map = new maplibregl.Map({
      container: node.current,
      style: rasterStyle,
      center: [firstPoint.longitude, firstPoint.latitude],
      zoom: 12,
      minZoom: 3,
      maxZoom: 19,
      attributionControl: false,
    });
    mapRef.current = map;
    setMapReady(false);
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.once('load', () => { setMapError(false); setMapReady(true); });
    map.on('error', (event) => {
      if (event.error?.message?.toLowerCase().includes('style')) setMapError(true);
    });
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(node.current);

    return () => {
      resizeObserver.disconnect();
      markers.forEach((marker) => marker.remove());
      markers.clear();
      mapRef.current = null;
      map.remove();
    };
    // The map lifecycle follows only the empty/non-empty boundary; point changes are handled incrementally below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocated]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentIds = new Set(located.map((point) => point.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
    located.forEach((point) => {
      const position: [number, number] = [point.longitude, point.latitude];
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(markerPopup(point));
      const existing = markersRef.current.get(point.id);
      if (existing) {
        existing.setLngLat(position).setPopup(popup);
      } else {
        markersRef.current.set(point.id, new maplibregl.Marker({ color: riskColor(point.risk), scale: 0.86 })
          .setLngLat(position).setPopup(popup).addTo(map));
      }
    });
  }, [located]);

  function fitAll() {
    const map = mapRef.current;
    if (!map || !located.length) return;
    if (located.length === 1) {
      map.jumpTo({ center: [located[0].longitude, located[0].latitude], zoom: 14 });
      return;
    }
    const bounds = located.reduce(
      (nextBounds, point) => nextBounds.extend([point.longitude, point.latitude]),
      new maplibregl.LngLatBounds(),
    );
    map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 0 });
  }

  function selectPoint(point: LocatedPoint) {
    setSelectedId(point.id);
    mapRef.current?.jumpTo({ center: [point.longitude, point.latitude] });
    const marker = markersRef.current.get(point.id);
    if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
  }

  if (!located.length) {
    return (
      <section className="rounded-lg border border-dashed bg-card p-8 text-center" aria-label="Mapa das vistorias do cliente">
        <h3 className="text-sm font-semibold">Nenhuma vistoria com coordenadas válidas</h3>
        <p className="mt-2 text-sm text-muted-foreground">Os dados sem latitude e longitude válidas não foram estimados nem exibidos.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-label="Mapa das vistorias do cliente">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-info-soft text-info">
              <Layers3 className="h-4 w-4" aria-hidden="true" />
            </span>
            Cobertura geográfica
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {located.length} ponto{located.length === 1 ? '' : 's'} com coordenadas autorizadas
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fitAll} disabled={!mapReady}>
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          Enquadrar pontos
        </Button>
      </header>

      <div className="relative">
        <div ref={node} data-testid="customer-map" data-map-ready={mapReady} className="h-[520px] min-h-[360px] w-full bg-muted sm:h-[560px]" />
        {!mapReady && !mapError && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]" role="status">
            <span className="rounded-full border bg-card px-4 py-2 text-xs font-semibold shadow-sm">Carregando mapa…</span>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
          <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Selecione um marcador ou use a lista textual
        </div>
        {mapError && (
          <div className="absolute inset-x-4 top-4 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="alert">
            O mapa-base não respondeu. Use a lista textual de pontos abaixo.
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <h3 className="text-sm font-semibold">Pontos em formato textual</h3>
        <p className="mt-1 text-xs text-muted-foreground">Selecione um item para localizar o mesmo ponto no mapa.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {located.map((point) => (
            <li key={point.id}>
              <Button type="button" variant="outline" className="h-auto w-full justify-start px-3 py-3 text-left" aria-pressed={selectedId === point.id} onClick={() => selectPoint(point)}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{point.protocol || 'Vistoria'}</span>
                  <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                    {point.address || 'Endereço protegido'} · risco {point.risk?.toUpperCase() || 'não informado'}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function markerPopup(point: CustomerMapPoint) {
  const popup = document.createElement('div');
  popup.className = 'space-y-1 p-1 text-xs';
  const title = document.createElement('strong');
  title.className = 'block text-sm';
  title.textContent = point.protocol || 'Vistoria';
  const risk = document.createElement('p');
  risk.textContent = `Risco: ${point.risk?.toUpperCase() || 'não informado'}`;
  const address = document.createElement('p');
  address.className = 'max-w-64 text-muted-foreground';
  address.textContent = point.address || 'Endereço protegido';
  popup.append(title, risk, address);
  return popup;
}

function riskColor(risk: string | null) {
  if (risk === 'r4' || risk === 'critico') return '#dc2626';
  if (risk === 'r3' || risk === 'alto') return '#ea580c';
  if (risk === 'r2' || risk === 'medio') return '#ca8a04';
  return '#16a34a';
}
