import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Circle } from 'lucide-react';

const FASES = [
  { num: 1, titulo: 'Setup + Auth Shell', feita: true },
  { num: 2, titulo: 'Usuários (tabela, aprovação, tokens)', feita: true },
  { num: 3, titulo: 'Ocorrências (vistorias + fotos)', feita: true },
  { num: 4, titulo: 'Agendamentos', feita: false },
  { num: 5, titulo: 'Mapa (MapLibre + clusters + heatmap)', feita: false },
  { num: 6, titulo: 'Laudos (Edge Function unificada)', feita: false },
  { num: 7, titulo: 'Relatórios (Recharts + CSV/PDF)', feita: false },
  { num: 8, titulo: 'Storage Lifecycle Drive', feita: false },
  { num: 9, titulo: 'Builds APK (EAS + GitHub Actions)', feita: false },
  { num: 10, titulo: 'Polish + Deploy', feita: false },
];

export function DashboardHome() {
  const { profile } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Bem-vindo, {profile?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Painel administrativo do TCS — Relatório de Risco
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Progresso do Dashboard</h2>
        <div className="space-y-2.5">
          {FASES.map((f) => (
            <div key={f.num} className="flex items-center gap-3">
              {f.feita ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 shrink-0" />
              )}
              <span
                className={
                  f.feita ? 'text-sm text-slate-900' : 'text-sm text-muted-foreground'
                }
              >
                <span className="font-medium">Fase {f.num}</span> — {f.titulo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
