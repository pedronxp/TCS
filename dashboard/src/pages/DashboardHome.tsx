import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2 } from 'lucide-react';

export function DashboardHome() {
  const { profile } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bem-vindo, {profile?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Painel administrativo do TCS — Relatório de Risco
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-slate-900">Fase 1 concluída — Setup + Auth</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Estrutura, autenticação e gate de role estão funcionando. As próximas fases adicionarão
              as telas de cada área (ocorrências, usuários, agendamentos, mapa, laudos, relatórios).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
