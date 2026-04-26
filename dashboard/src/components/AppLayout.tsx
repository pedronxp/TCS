import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (typeof document !== 'undefined') {
    document.title = `${title} — TCS Painel Admin`;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <header className="h-14 border-b border-slate-200 bg-white px-4 lg:px-8 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm text-muted-foreground">
            TCS — Relatório de Risco
            <span className="mx-2 text-slate-300">/</span>
            <span className="text-slate-700 font-medium">{title}</span>
          </p>
        </header>
        <main className="flex-1">
          <div className="px-4 py-4 lg:px-8 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
