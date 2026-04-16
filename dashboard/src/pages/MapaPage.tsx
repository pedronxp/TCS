import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, MapPin, Calendar, RotateCcw, Loader2 } from 'lucide-react';
import { useMapaDados, type PinVistoria, type PinAgendamento } from '@/hooks/useMapaDados';
import { cn } from '@/lib/utils';

// ─── Constantes ───────────────────────────────────────────────────────────────

// Centro em Belém-PA
const CENTER: [number, number] = [-48.5044, -1.4558];
const ZOOM = 10;

const RISCO_COR: Record<string, string> = {
  r1: '#16a34a',
  r2: '#eab308',
  r3: '#ea580c',
  r4: '#dc2626',
};

const RISCO_LABEL: Record<string, string> = {
  r1: 'R1 — Baixo',
  r2: 'R2 — Médio',
  r3: 'R3 — Alto',
  r4: 'R4 — Crítico',
};

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function popupVistoria(v: PinVistoria): string {
  const cor = RISCO_COR[v.nivelRisco] ?? '#94a3b8';
  return `
    <div style="font-family:system-ui;min-width:200px;padding:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></span>
        <strong style="font-size:13px">${RISCO_LABEL[v.nivelRisco] ?? v.nivelRisco}</strong>
      </div>
      <p style="font-size:12px;color:#475569;margin:0 0 4px">${v.endereco ?? '—'}</p>
      ${v.municipio ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px">${v.municipio}</p>` : ''}
      ${v.agenteNome ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px">Agente: ${v.agenteNome}</p>` : ''}
      ${v.dataVistoria ? `<p style="font-size:11px;color:#94a3b8;margin:0">${new Date(v.dataVistoria).toLocaleDateString('pt-BR')}</p>` : ''}
      ${v.protocolo ? `<p style="font-size:10px;color:#94a3b8;margin:4px 0 0;font-family:monospace">${v.protocolo}</p>` : ''}
    </div>`;
}

function popupAgendamento(a: PinAgendamento): string {
  return `
    <div style="font-family:system-ui;min-width:200px;padding:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:#3b82f6;flex-shrink:0"></span>
        <strong style="font-size:13px">${a.titulo ?? 'Agendamento'}</strong>
      </div>
      <p style="font-size:12px;color:#475569;margin:0 0 4px">${a.endereco ?? '—'}</p>
      ${a.municipio ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px">${a.municipio}</p>` : ''}
      ${a.agente_nome ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px">Agente: ${a.agente_nome}</p>` : ''}
      ${a.data_agendada ? `<p style="font-size:11px;color:#94a3b8;margin:0">${new Date(a.data_agendada).toLocaleString('pt-BR')}</p>` : ''}
    </div>`;
}

// ─── Marker SVG ───────────────────────────────────────────────────────────────

function criarElementoMarker(cor: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width:28px;height:36px;cursor:pointer;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));
  `;
  el.innerHTML = `
    <svg viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="${cor}"/>
      <circle cx="14" cy="14" r="6" fill="white" fill-opacity="0.9"/>
    </svg>`;
  return el;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function MapaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [mostrarVistorias, setMostrarVistorias] = useState(true);
  const [mostrarAgendamentos, setMostrarAgendamentos] = useState(true);
  const [mapPronto, setMapPronto] = useState(false);

  const { vistorias, agendamentos } = useMapaDados();

  // Inicializa o mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: CENTER,
      zoom: ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.on('load', () => setMapPronto(true));

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualiza markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapPronto) return;

    // Remove markers anteriores
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const popup = (html: string) =>
      new maplibregl.Popup({ offset: 28, closeButton: true, maxWidth: '280px' }).setHTML(html);

    // Vistorias
    if (mostrarVistorias && vistorias.data) {
      vistorias.data.forEach((v) => {
        const cor = RISCO_COR[v.nivelRisco] ?? '#94a3b8';
        const marker = new maplibregl.Marker({ element: criarElementoMarker(cor) })
          .setLngLat([v.lng, v.lat])
          .setPopup(popup(popupVistoria(v)))
          .addTo(map);
        markersRef.current.push(marker);
      });
    }

    // Agendamentos
    if (mostrarAgendamentos && agendamentos.data) {
      agendamentos.data.forEach((a) => {
        const marker = new maplibregl.Marker({ element: criarElementoMarker('#3b82f6') })
          .setLngLat([a.lng, a.lat])
          .setPopup(popup(popupAgendamento(a)))
          .addTo(map);
        markersRef.current.push(marker);
      });
    }
  }, [mapPronto, mostrarVistorias, mostrarAgendamentos, vistorias.data, agendamentos.data]);

  // Stats
  const statsRisco = ['r4', 'r3', 'r2', 'r1'].map((r) => ({
    nivel: r,
    count: vistorias.data?.filter((v) => v.nivelRisco === r).length ?? 0,
  }));
  const totalAgendados = agendamentos.data?.length ?? 0;
  const isLoading = vistorias.isLoading || agendamentos.isLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Cabeçalho */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mapa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vistorias e agendamentos georreferenciados
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Mapa */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative">
          <div ref={containerRef} className="w-full h-full" />

          {/* Controle de camadas */}
          <div className="absolute top-3 left-3 z-10 bg-white rounded-xl shadow-md border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
              <Layers className="w-3.5 h-3.5" /> Camadas
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarVistorias}
                onChange={(e) => setMostrarVistorias(e.target.checked)}
                className="accent-primary"
              />
              <MapPin className="w-3 h-3 text-red-500" />
              <span className="text-xs text-slate-700">Vistorias</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarAgendamentos}
                onChange={(e) => setMostrarAgendamentos(e.target.checked)}
                className="accent-primary"
              />
              <Calendar className="w-3 h-3 text-blue-500" />
              <span className="text-xs text-slate-700">Agendamentos</span>
            </label>
          </div>
        </div>

        {/* Painel lateral */}
        <div className="w-56 shrink-0 space-y-3">
          {/* Vistorias por risco */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Vistorias por risco
            </h3>
            {statsRisco.map((s) => (
              <div key={s.nivel} className="flex items-center gap-2 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: RISCO_COR[s.nivel] }}
                />
                <span className="text-xs text-slate-600 flex-1">{RISCO_LABEL[s.nivel]}</span>
                <span className="text-xs font-bold text-slate-900">{s.count}</span>
              </div>
            ))}
            <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between">
              <span className="text-xs text-slate-500">Total</span>
              <span className="text-xs font-bold">{vistorias.data?.length ?? 0}</span>
            </div>
          </div>

          {/* Agendamentos */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Agendamentos
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-xs text-slate-600 flex-1">Pendentes</span>
              <span className="text-xs font-bold text-slate-900">{totalAgendados}</span>
            </div>
          </div>

          {/* Sem dados */}
          {!isLoading && (vistorias.data?.length ?? 0) === 0 && totalAgendados === 0 && (
            <div className={cn(
              'bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center'
            )}>
              <MapPin className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-muted-foreground">
                Nenhum ponto georreferenciado ainda.
              </p>
            </div>
          )}

          {/* Erros */}
          {(vistorias.isError || agendamentos.isError) && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">Erro ao carregar dados do mapa.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
