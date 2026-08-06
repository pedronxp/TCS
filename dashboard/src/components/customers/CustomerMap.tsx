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
  layers: [
    {
      id: 'openstreetmap',
      type: 'raster',
      source: 'openstreetmap',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export function CustomerMap({ points }: { points: CustomerMapPoint[] }) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const located = useMemo(
    () => points.filter(
      (point): point is CustomerMapPoint & { latitude: number; longitude: number } =>
        point.latitude !== null && point.longitude !== null,
    ),
    [points],
  );

  useEffect(() => {
    if (!node.current || !located.length) return;

    const map = new maplibregl.Map({
      container: node.current,
      style: rasterStyle,
      center: [located[0].longitude, located[0].latitude],
      zoom: 12,
      minZoom: 3,
      maxZoom: 19,
      attributionControl: false,
    });
    mapRef.current = map;
    setMapReady(false);
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const bounds = new maplibregl.LngLatBounds();
    const markers = located.map((point) => {
      const position: [number, number] = [point.longitude, point.latitude];
      bounds.extend(position);
      return new maplibregl.Marker({ color: riskColor(point.risk), scale: 0.86 })
        .setLngLat(position)
        .setPopup(
          new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(
            markerPopup(point),
          ),
        )
        .addTo(map);
    });

    map.once('load', () => {
      setMapError(false);
      if (located.length > 1) {
        map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 0 });
      }
    });
    map.once('idle', () => setMapReady(true));
    map.on('error', (event) => {
      if (event.error?.message?.toLowerCase().includes('style')) setMapError(true);
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(node.current);

    return () => {
      resizeObserver.disconnect();
      markers.forEach((marker) => marker.remove());
      mapRef.current = null;
      map.remove();
    };
  }, [located]);

  function fitAll() {
    const map = mapRef.current;
    if (!map || !located.length) return;
    if (located.length === 1) {
      map.easeTo({ center: [located[0].longitude, located[0].latitude], zoom: 14 });
      return;
    }
    const bounds = located.reduce(
      (nextBounds, point) => nextBounds.extend([point.longitude, point.latitude]),
      new maplibregl.LngLatBounds(),
    );
    map.fitBounds(bounds, { padding: 72, maxZoom: 15 });
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
        <Button type="button" variant="outline" size="sm" onClick={fitAll}>
          <Maximize2 className="h-4 w-4" />
          Enquadrar pontos
        </Button>
      </header>

      <div className="relative">
        <div
          ref={node}
          data-testid="customer-map"
          data-map-ready={mapReady}
          className="h-[520px] min-h-[360px] w-full bg-muted sm:h-[560px]"
        />
        {!mapReady && !mapError && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]">
            <span className="rounded-full border bg-card px-4 py-2 text-xs font-semibold shadow-sm">
              Carregando mapa…
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
          <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Clique em um marcador para ver protocolo e risco
        </div>
        {mapError && (
          <div className="absolute inset-x-4 top-4 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
            O mapa-base não respondeu. Os pontos continuam disponíveis e uma nova tentativa ocorrerá ao reabrir esta seção.
          </div>
        )}
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
