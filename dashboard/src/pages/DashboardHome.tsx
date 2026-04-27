import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users, Calendar, FileText, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';

function useOverviewStats() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['overview-stats', profile?.role, profile?.municipio],
    queryFn: async () => {
      const desde30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const hoje = new Date().toISOString().slice(0, 10);

      const applyMunicFilter = (q: any) =>
        profile?.role !== 'master_admin' ? q.eq('municipio', profile?.municipio) : q;

      const vistoriaCount = (risco?: string) => {
        let q = supabase
          .from('vistorias')
          .select('id', { count: 'exact', head: true })
          .gte('dataVistoria', desde30d);
        if (risco) q = q.eq('nivelRisco', risco);
        return applyMunicFilter(q);
      };

      const [total30d, r1Count, r2Count, r3Count, r4Count, agendamentos, usuarios, recentes] = await Promise.all([
        vistoriaCount(),
        vistoriaCount('r1'),
        vistoriaCount('r2'),
        vistoriaCount('r3'),
        vistoriaCount('r4'),
        applyMunicFilter(
          supabase.from('agendamentos').select('id, status', { count: 'exact' })
            .in('status', ['pendente', 'agendado'])
            .gte('data_agendada', hoje)
        ),
        profile?.role === 'master_admin'
          ? supabase.from('users').select('isApproved', { count: 'exact' }).neq('role', 'master_admin')
          : supabase.from('users').select('isApproved', { count: 'exact' })
              .neq('role', 'master_admin')
              .eq('municipio', profile?.municipio ?? ''),
        applyMunicFilter(
          supabase.from('vistorias')
            .select('id, endereco, nivelRisco, agenteNome, dataVistoria, municipio')
            .order('dataVistoria', { ascending: false })
            .limit(5)
        ),
      ]);

      const r1 = r1Count.count ?? 0;
      const r2 = r2Count.count ?? 0;
      const r3 = r3Count.count ?? 0;
      const r4 = r4Count.count ?? 0;
      const totalVist = total30d.count ?? 0;

      const usersData = usuarios.data ?? [];
      const ativos = usersData.filter((u: any) => u.isApproved).length;
      const pendentes = usersData.filter((u: any) => !u.isApproved).length;

      return {
        totalVist,
        r1, r2, r3, r4,
        alto: r3 + r4,
        agendamentosPendentes: agendamentos.count ?? (agendamentos.data?.length ?? 0),
        usuariosAtivos: ativos,
        usuariosPendentes: pendentes,
        recentes: recentes.data ?? [],
      };
    },
    enabled: !!profile,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

const RISCO_LABEL: Record<string, string> = { r1: 'Baixo', r2: 'Médio', r3: 'Alto', r4: 'Iminente' };
const RISCO_COLOR: Record<string, string> = {
  r1: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  r2: 'text-amber-600 bg-amber-50 border-amber-200',
  r3: 'text-orange-600 bg-orange-50 border-orange-200',
  r4: 'text-red-600 bg-red-50 border-red-200',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function DashboardHome() {
  const { profile } = useAuth();
  const { data: s, isLoading } = useOverviewStats();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
          <img src="/app-icon.png" alt="TCS" className="w-14 h-14 object-contain" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bem-vindo, {profile?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            TCS — Relatório de Risco · Painel administrativo
            {profile?.municipio ? ` · ${profile.municipio}` : ''}
          </p>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          label="Vistorias (30 dias)"
          value={isLoading ? '…' : String(s?.totalVist ?? 0)}
          sub={isLoading ? '' : `${s?.alto ?? 0} alto risco`}
          subColor="text-red-500"
          href="/ocorrencias"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          bg="bg-red-50"
          label="Alto / Iminente"
          value={isLoading ? '…' : String(s?.alto ?? 0)}
          sub={isLoading ? '' : `${s?.r4 ?? 0} iminente`}
          subColor="text-red-600"
          href="/ocorrencias"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5 text-violet-600" />}
          bg="bg-violet-50"
          label="Agendamentos futuros"
          value={isLoading ? '…' : String(s?.agendamentosPendentes ?? 0)}
          sub="pendentes / agendados"
          href="/agendamentos"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-50"
          label="Usuários ativos"
          value={isLoading ? '…' : String(s?.usuariosAtivos ?? 0)}
          sub={isLoading ? '' : s?.usuariosPendentes ? `${s.usuariosPendentes} pendente(s)` : 'todos aprovados'}
          subColor={s?.usuariosPendentes ? 'text-amber-500' : undefined}
          href="/usuarios"
        />
      </div>

      {/* Distribuição de risco + Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Distribuição de risco (30d)</h2>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(['r4','r3','r2','r1'] as const).map((r) => {
                const count = s?.[r] ?? 0;
                const total = s?.totalVist || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={r}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-semibold ${RISCO_COLOR[r].split(' ')[0]}`}>{RISCO_LABEL[r]}</span>
                      <span className="text-slate-500">{count} vistoria{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r === 'r4' ? 'bg-red-500' :
                          r === 'r3' ? 'bg-orange-400' :
                          r === 'r2' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recentes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Vistorias recentes</h2>
            </div>
            <Link to="/ocorrencias" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : s?.recentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma vistoria registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {s?.recentes.map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RISCO_COLOR[v.nivelRisco] ?? 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                    {v.nivelRisco?.toUpperCase() ?? '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {v.endereco ?? '—'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {v.agenteNome ?? '—'} · {fmt(v.dataVistoria)}
                      {v.municipio ? ` · ${v.municipio}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: '/ocorrencias', icon: <AlertTriangle className="w-4 h-4" />, label: 'Ocorrências' },
          { to: '/agendamentos', icon: <Calendar className="w-4 h-4" />, label: 'Agendamentos' },
          { to: '/mapa', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Mapa de risco' },
          { to: '/usuarios', icon: <Users className="w-4 h-4" />, label: 'Usuários' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-2.5 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <span className="text-primary">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon, bg, label, value, sub, subColor, href,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all block"
    >
      <div className={`w-9 h-9 rounded-lg ${bg} grid place-items-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-1 font-medium ${subColor ?? 'text-slate-400'}`}>{sub}</p>}
    </Link>
  );
}
