import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Visão Geral',
  '/ocorrencias': 'Ocorrências',
  '/usuarios': 'Usuários',
  '/agendamentos': 'Agendamentos',
  '/mapa': 'Mapa',
  '/laudos': 'Laudos',
  '/relatorios': 'Relatórios',
  '/arquivamento': 'Arquivamento',
  '/builds': 'Builds APK',
  '/configuracoes': 'Configurações',
};

export function AppLayout() {
  const { pathname } = useLocation();
  const title = ROUTE_TITLES[pathname] ?? 'TCS';

  if (typeof document !== 'undefined') {
    document.title = `${title} — TCS Painel Admin`;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <header className="h-14 border-b border-slate-200 bg-white px-8 flex items-center shrink-0">
          <p className="text-sm text-muted-foreground">
            TCS — Relatório de Risco
            <span className="mx-2 text-slate-300">/</span>
            <span className="text-slate-700 font-medium">{title}</span>
          </p>
        </header>
        <main className="flex-1">
          <div className="px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
