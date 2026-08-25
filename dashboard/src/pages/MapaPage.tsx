import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, MapPin, Calendar, RotateCcw, Loader2, Search, X, Navigation } from 'lucide-react';
import { useMapaDados, type PinVistoria, type PinAgendamento } from '@/hooks/useMapaDados';
import { cn } from '@/lib/utils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CENTER_PADRAO: [number, number] = [-48.5044, -1.4558]; // Belém-PA
const ZOOM = 13;

const RISCO_COR: Record<string, string> = {
  r1: 'hsl(var(--risk-r1))',
  r2: 'hsl(var(--risk-r2))',
  r3: 'hsl(var(--risk-r3))',
  r4: 'hsl(var(--risk-r4))',
};

const RISCO_LABEL: Record<string, string> = {
  r1: 'R1 — Baixo',
  r2: 'R2 — Médio',
  r3: 'R3 — Alto',
  r4: 'R4 — Crítico',
};

// ─── Geocodificação (Nominatim + ViaCEP) ──────────────────────────────────────

async function geocodificar(termo: string): Promise<[number, number] | null> {
  const cep = termo.replace(/\D/g, '');
  if (cep.length === 8) {
    // Busca CEP via ViaCEP
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      if (!data.erro) {
        const query = `${data.logradouro ?? ''} ${data.bairro ?? ''} ${data.localidade} ${data.uf} Brasil`.trim();
        return geocodificarNominatim(query);
      }
    }
  }
  return geocodificarNominatim(`${termo}, Brasil`);
}

async function geocodificarNominatim(query: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json();
  if (!data[0]) return null;
  return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function popupVistoria(v: PinVistoria): string {
  const cor = RISCO_COR[v.nivelRisco] ?? 'hsl(var(--muted-foreground))';
  const risco = escapeHtml(RISCO_LABEL[v.nivelRisco] ?? v.nivelRisco);
  const endereco = escapeHtml(v.endereco ?? '—');
  const municipio = escapeHtml(v.municipio ?? '');
  const agenteNome = escapeHtml(v.agenteNome ?? '');
  const protocolo = escapeHtml(v.protocolo ?? '');
  return `
    <div style="font-family:system-ui;min-width:200px;padding:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></span>
        <strong style="font-size:13px">${risco}</strong>
      </div>
      <p style="font-size:12px;color:hsl(var(--muted-foreground));margin:0 0 4px">${endereco}</p>
      ${municipio ? `<p style="font-size:11px;color:hsl(var(--muted-foreground));margin:0 0 4px">${municipio}</p>` : ''}
      ${agenteNome ? `<p style="font-size:11px;color:hsl(var(--muted-foreground));margin:0 0 4px">Agente: ${agenteNome}</p>` : ''}
      ${v.dataVistoria ? `<p style="font-size:11px;color:hsl(var(--muted-foreground)/0.7);margin:0">${new Date(v.dataVistoria).toLocaleDateString('pt-BR')}</p>` : ''}
      ${protocolo ? `<p style="font-size:10px;color:hsl(var(--muted-foreground)/0.7);margin:4px 0 0;font-family:monospace">${protocolo}</p>` : ''}
    </div>`;
}

function popupAgendamento(a: PinAgendamento): string {
  const titulo = escapeHtml(a.titulo ?? 'Agendamento');
  const endereco = escapeHtml(a.endereco ?? '—');
  const municipio = escapeHtml(a.municipio ?? '');
  const agenteNome = escapeHtml(a.agente_nome ?? '');
  return `
    <div style="font-family:system-ui;min-width:200px;padding:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:hsl(var(--info));flex-shrink:0"></span>
        <strong style="font-size:13px">${titulo}</strong>
      </div>
      <p style="font-size:12px;color:hsl(var(--muted-foreground));margin:0 0 4px">${endereco}</p>
      ${municipio ? `<p style="font-size:11px;color:hsl(var(--muted-foreground));margin:0 0 4px">${municipio}</p>` : ''}
      ${agenteNome ? `<p style="font-size:11px;color:hsl(var(--muted-foreground));margin:0 0 4px">Agente: ${agenteNome}</p>` : ''}
      ${a.data_agendada ? `<p style="font-size:11px;color:hsl(var(--muted-foreground)/0.7);margin:0">${new Date(a.data_agendada).toLocaleString('pt-BR')}</p>` : ''}
    </div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });
}

// ─── Marker SVG ───────────────────────────────────────────────────────────────

function criarElementoMarker(cor: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'width:28px;height:36px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))';
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
  const geoMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [mostrarVistorias, setMostrarVistorias] = useState(true);
  const [mostrarAgendamentos, setMostrarAgendamentos] = useState(true);
  const [mapPronto, setMapPronto] = useState(false);

  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState('');

  const [geolocalizando, setGeolocalizando] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroRisco, setFiltroRisco] = useState('all');
  const [filtroResponsavel, setFiltroResponsavel] = useState('all');
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');

  const { vistorias, agendamentos } = useMapaDados();

  const responsaveis = useMemo(() => Array.from(new Set([
    ...(vistorias.data ?? []).map((item) => item.agenteNome),
    ...(agendamentos.data ?? []).map((item) => item.agente_nome),
  ].filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right, 'pt-BR')), [agendamentos.data, vistorias.data]);

  const textoNormalizado = filtroTexto.trim().toLocaleLowerCase('pt-BR');
  const dentroDoPeriodo = useCallback((value: string | null) => {
    if (!value) return !filtroInicio && !filtroFim;
    const date = value.slice(0, 10);
    return (!filtroInicio || date >= filtroInicio) && (!filtroFim || date <= filtroFim);
  }, [filtroFim, filtroInicio]);
  const vistoriasFiltradas = useMemo(() => (vistorias.data ?? []).filter((item) => {
    const text = [item.protocolo, item.endereco, item.municipio, item.agenteNome].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    return (!textoNormalizado || text.includes(textoNormalizado))
      && (filtroRisco === 'all' || item.nivelRisco === filtroRisco)
      && (filtroResponsavel === 'all' || item.agenteNome === filtroResponsavel)
      && dentroDoPeriodo(item.dataVistoria);
  }), [dentroDoPeriodo, filtroResponsavel, filtroRisco, textoNormalizado, vistorias.data]);
  const agendamentosFiltrados = useMemo(() => (agendamentos.data ?? []).filter((item) => {
    const text = [item.titulo, item.endereco, item.municipio, item.agente_nome].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    return (!textoNormalizado || text.includes(textoNormalizado))
      && filtroRisco === 'all'
      && (filtroResponsavel === 'all' || item.agente_nome === filtroResponsavel)
      && dentroDoPeriodo(item.data_agendada);
  }), [agendamentos.data, dentroDoPeriodo, filtroResponsavel, filtroRisco, textoNormalizado]);
  const filtrosAtivos = Boolean(filtroTexto || filtroRisco !== 'all' || filtroResponsavel !== 'all' || filtroInicio || filtroFim);

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
      center: CENTER_PADRAO,
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

  // Atualiza markers de dados
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapPronto) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const popup = (html: string) =>
      new maplibregl.Popup({ offset: 28, closeButton: true, maxWidth: '280px' }).setHTML(html);

    if (mostrarVistorias) {
      vistoriasFiltradas.forEach((v) => {
        const marker = new maplibregl.Marker({ element: criarElementoMarker(RISCO_COR[v.nivelRisco] ?? '#94a3b8') })
          .setLngLat([v.lng, v.lat])
          .setPopup(popup(popupVistoria(v)))
          .addTo(map);
        markersRef.current.push(marker);
      });
    }

    if (mostrarAgendamentos) {
      agendamentosFiltrados.forEach((a) => {
        const marker = new maplibregl.Marker({ element: criarElementoMarker('hsl(var(--info))') })
          .setLngLat([a.lng, a.lat])
          .setPopup(popup(popupAgendamento(a)))
          .addTo(map);
        markersRef.current.push(marker);
      });
    }
  }, [agendamentosFiltrados, mapPronto, mostrarAgendamentos, mostrarVistorias, vistoriasFiltradas]);

  // Busca cidade / CEP
  const handleBusca = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busca.trim() || !mapRef.current) return;
    setBuscando(true);
    setErroBusca('');
    const coords = await geocodificar(busca.trim());
    setBuscando(false);
    if (!coords) {
      setErroBusca('Local não encontrado. Tente o nome da cidade ou CEP.');
      return;
    }
    const map = mapRef.current;
    map.flyTo({ center: coords, zoom: ZOOM, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600 });

    // Marker temporário do local buscado
    geoMarkerRef.current?.remove();
    const el = document.createElement('div');
    el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:hsl(var(--info));border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)';
    geoMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat(coords)
      .setPopup(new maplibregl.Popup({ offset: 14 }).setText(busca))
      .addTo(map);
  }, [busca]);

  // Geolocalização manual
  const handleGeolocalizacao = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    setGeolocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocalizando(false);
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        mapRef.current!.flyTo({ center: coords, zoom: ZOOM, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600 });

        geoMarkerRef.current?.remove();
        const el = document.createElement('div');
        el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:hsl(var(--info));border:3px solid white;box-shadow:0 0 0 4px hsl(var(--info)/0.25)';
        geoMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(coords)
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText('Sua localização'))
          .addTo(mapRef.current!);
      },
      () => setGeolocalizando(false)
    );
  }, []);

  const statsRisco = ['r4', 'r3', 'r2', 'r1'].map((r) => ({
    nivel: r,
    count: vistoriasFiltradas.filter((v) => v.nivelRisco === r).length,
  }));
  const totalAgendados = agendamentosFiltrados.length;
  const isLoading = vistorias.isLoading || agendamentos.isLoading;

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Mapa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vistorias e agendamentos georreferenciados</p>
        </div>

        {/* Barra de busca — full width mobile */}
        <form onSubmit={handleBusca} className="flex gap-2 sm:ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setErroBusca(''); }}
              placeholder="Cidade ou CEP..."
              className="h-9 pl-9 pr-8 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-52"
            />
            {busca && (
              <button type="button" onClick={() => { setBusca(''); setErroBusca(''); geoMarkerRef.current?.remove(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button type="submit" disabled={buscando || !busca.trim()}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 shrink-0">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="hidden sm:inline">Buscar</span>
          </button>
          <button type="button" onClick={handleGeolocalizacao} disabled={geolocalizando} title="Minha localização"
            className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-50 shrink-0">
            {geolocalizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          </button>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </form>
      </div>

      {erroBusca && (
        <p className="text-xs text-destructive -mt-2">{erroBusca}</p>
      )}

      <section className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(150px,1fr))_auto]" aria-label="Filtros dos registros do mapa">
        <label className="relative">
          <span className="sr-only">Pesquisar registros</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={filtroTexto} onChange={(event) => setFiltroTexto(event.target.value)} placeholder="Protocolo, endereço ou usuário" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label><span className="sr-only">Filtrar por risco</span><select value={filtroRisco} onChange={(event) => setFiltroRisco(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="all">Todos os riscos</option>{Object.entries(RISCO_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="sr-only">Filtrar por responsável</span><select value={filtroResponsavel} onChange={(event) => setFiltroResponsavel(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="all">Todos os usuários</option>{responsaveis.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label><span className="sr-only">Data inicial</span><input type="date" value={filtroInicio} onChange={(event) => setFiltroInicio(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
        <label><span className="sr-only">Data final</span><input type="date" value={filtroFim} onChange={(event) => setFiltroFim(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
        <button type="button" disabled={!filtrosAtivos} onClick={() => { setFiltroTexto(''); setFiltroRisco('all'); setFiltroResponsavel('all'); setFiltroInicio(''); setFiltroFim(''); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40"><X className="h-4 w-4" />Limpar</button>
      </section>

      {/* Corpo: mapa + painel — coluna no mobile, linha no desktop */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Mapa */}
        <div className="flex-1 rounded-lg overflow-hidden border border-border relative" style={{ minHeight: 0 }}>
          <div ref={containerRef} className="w-full h-[55vw] sm:h-[420px] lg:h-[calc(100vh-220px)]" />

          {/* Camadas */}
          <div className="absolute top-3 left-3 z-10 bg-card rounded-lg border border-border p-3 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
              <Layers className="w-3.5 h-3.5" /> Camadas
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={mostrarVistorias}
                onChange={(e) => setMostrarVistorias(e.target.checked)} className="accent-primary" />
              <MapPin className="w-3 h-3 text-destructive" />
              <span className="text-xs text-foreground">Vistorias</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={mostrarAgendamentos}
                onChange={(e) => setMostrarAgendamentos(e.target.checked)} className="accent-primary" />
              <Calendar className="w-3 h-3 text-info" />
              <span className="text-xs text-foreground">Agendamentos</span>
            </label>
          </div>
        </div>

        {/* Painel de stats — linha no mobile, coluna no desktop */}
        <div className="flex flex-row lg:flex-col gap-3 lg:w-52 lg:shrink-0">
          <div className="flex-1 bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Vistorias por risco</h3>
            {statsRisco.map((s) => (
              <div key={s.nivel} className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RISCO_COR[s.nivel] }} />
                <span className="text-xs text-muted-foreground flex-1 hidden sm:block">{RISCO_LABEL[s.nivel]}</span>
                <span className="text-xs text-muted-foreground flex-1 sm:hidden">{s.nivel.toUpperCase()}</span>
                <span className="text-xs font-bold text-foreground">{s.count}</span>
              </div>
            ))}
            <div className="border-t border-border mt-2 pt-2 flex justify-between">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-xs font-bold">{vistoriasFiltradas.length}</span>
            </div>
          </div>

          <div className="flex-1 lg:flex-none bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Agendamentos</h3>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-info shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">Pendentes</span>
              <span className="text-xs font-bold text-foreground">{totalAgendados}</span>
            </div>
          </div>

          {!isLoading && vistoriasFiltradas.length === 0 && totalAgendados === 0 && (
            <div className={cn('flex-1 lg:flex-none bg-secondary border border-dashed border-border rounded-lg p-4 text-center')}>
              <MapPin className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">{filtrosAtivos ? 'Nenhum ponto corresponde aos filtros.' : 'Nenhum ponto georreferenciado ainda.'}</p>
            </div>
          )}

          {(vistorias.isError || agendamentos.isError) && (
            <div className="flex-1 lg:flex-none bg-destructive-soft border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">Erro ao carregar dados do mapa.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
