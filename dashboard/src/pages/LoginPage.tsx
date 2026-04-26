import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { signIn, isAuthorized, loading: authLoading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [erro, setErro]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mapContainerRef  = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<maplibregl.Map | null>(null);
  const rafRef           = useRef<number>(0);

  /* ── Mapa de fundo ── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
            tileSize: 256,
            attribution: '',
          },
        },
        layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
      },
      center: [-48.5044, -1.4558],
      zoom: 11,
      bearing: 0,
      pitch: 40,
      interactive: false,
      attributionControl: false,
    });

    map.on('load', () => {
      let bearing = 0;
      const rotate = () => {
        bearing += 0.015;
        map.setBearing(bearing % 360);
        rafRef.current = requestAnimationFrame(rotate);
      };
      rafRef.current = requestAnimationFrame(rotate);
    });

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  if (authLoading) return <TelaCarregando />;
  if (isAuthorized) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    if (error) { setErro(error); setSubmitting(false); }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">

      {/* Mapa */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Camadas de overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/75 via-slate-900/55 to-slate-950/75 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(2,6,23,.85) 100%)' }}
      />

      {/* Conteúdo */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">

        {/* Logo + título */}
        <div
          className="text-center mb-8"
          style={{ animation: 'fadeUp .55s cubic-bezier(.16,1,.3,1) both' }}
        >
          <div
            className="relative inline-flex mb-5"
            style={{ animation: 'popIn .65s .08s cubic-bezier(.34,1.56,.64,1) both' }}
          >
            {/* Glow atrás do ícone */}
            <div className="absolute inset-0 rounded-[28px] blur-2xl scale-[1.6] opacity-60"
              style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
            <img
              src="/app-icon.png"
              alt="TCS"
              className="relative w-24 h-24 rounded-[28px] shadow-2xl object-cover ring-2 ring-white/10"
            />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">TCS — Painel</h1>
          <p className="text-slate-400 mt-1.5 text-sm">Acesso restrito a administradores</p>
        </div>

        {/* Card glassmorphism */}
        <div
          className="w-full max-w-sm rounded-2xl p-8 space-y-5"
          style={{
            background: 'rgba(8,14,36,0.65)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 32px 64px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07)',
            animation: 'fadeUp .55s .12s cubic-bezier(.16,1,.3,1) both',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 tracking-wide uppercase">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="seu@email.com"
                className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,.3)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,.6)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Senha</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={submitting}
                  className="w-full h-11 px-4 pr-11 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition-all disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,.3)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,.6)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div
                className="rounded-xl px-4 py-3 text-sm text-red-300"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  animation: 'shake .4s cubic-bezier(.36,.07,.19,.97) both',
                }}
              >
                {erro}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
                boxShadow: submitting ? 'none' : '0 4px 24px rgba(37,99,235,.5), inset 0 1px 0 rgba(255,255,255,.15)',
              }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-[11px] text-slate-600 text-center pt-1 border-t border-white/5">
            Apenas contas <span className="text-slate-500 font-medium">admin</span> e{' '}
            <span className="text-slate-500 font-medium">master_admin</span> aprovadas têm acesso.
          </p>
        </div>

        {/* Crédito mapa */}
        <p className="relative z-10 mt-6 text-[10px] text-slate-700">
          © <a href="https://carto.com" target="_blank" rel="noreferrer" className="hover:text-slate-500 transition-colors">CartoDB</a>
          {' · '}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-slate-500 transition-colors">OpenStreetMap</a>
        </p>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-7px); }
          40%     { transform: translateX(7px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }
        /* esconde controles do mapa */
        .maplibregl-ctrl-logo,
        .maplibregl-ctrl-attrib { display: none !important; }
      `}</style>
    </div>
  );
}

function TelaCarregando() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-950">
      <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
    </div>
  );
}
