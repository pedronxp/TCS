import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, Users, Calendar,
  Map, FileText, BarChart3, Archive, Smartphone,
  Settings, LogOut, X, CreditCard, Building2, BadgeDollarSign,
  MonitorSmartphone, LifeBuoy, TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  masterOnly?: boolean;
  roles?: string[];
}

const NAV: NavItem[] = [
  { to: '/',             label: 'Visão Geral',  icon: LayoutDashboard },
  { to: '/indicadores-comerciais', label: 'Indicadores', icon: TrendingUp, masterOnly: true },
  { to: '/planos', label: 'Planos e recursos', icon: CreditCard, masterOnly: true },
  { to: '/organizacoes', label: 'Organizações', icon: Building2, masterOnly: true },
  { to: '/assinaturas', label: 'Assinaturas', icon: BadgeDollarSign, masterOnly: true },
  { to: '/sessoes', label: 'Sessões', icon: MonitorSmartphone, masterOnly: true },
  { to: '/suporte', label: 'Suporte', icon: LifeBuoy, masterOnly: true },
  { to: '/ocorrencias',  label: 'Ocorrências',  icon: AlertTriangle },
  { to: '/usuarios',     label: 'Usuários',     icon: Users, roles: ['master_admin', 'admin'] },
  { to: '/agendamentos', label: 'Agendamentos', icon: Calendar },
  { to: '/mapa',         label: 'Mapa',         icon: Map },
  { to: '/laudos',       label: 'Laudos',       icon: FileText },
  { to: '/relatorios',   label: 'Relatórios',   icon: BarChart3 },
  { to: '/arquivamento', label: 'Arquivamento', icon: Archive,    masterOnly: true },
  { to: '/builds',       label: 'Builds APK',   icon: Smartphone, masterOnly: true },
  { to: '/configuracoes',label: 'Configurações',icon: Settings,   masterOnly: true },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const isMaster = profile?.role === 'master_admin';
  const visibleNav = NAV.filter((item) => {
    if (item.masterOnly && !isMaster) return false;
    if (item.roles && !item.roles.includes(profile?.role ?? '')) return false;
    return true;
  });
  const roleLabel =
    profile?.role === 'master_admin'
      ? 'Master Admin'
      : profile?.role === 'supervisor'
        ? 'Supervisor'
        : 'Admin';

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'w-64 bg-slate-900 text-slate-100 flex flex-col h-screen',
          // Desktop: sempre visível, sticky
          'lg:sticky lg:top-0 lg:translate-x-0',
          // Mobile: overlay deslizante
          'fixed top-0 left-0 z-50 transition-transform duration-300 lg:transition-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-bold text-base leading-tight tracking-wide">TCS</h1>
              <p className="text-[11px] text-slate-400 leading-tight">Painel Admin</p>
            </div>
          </div>
          {/* Botão fechar — só mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 sidebar-scroll overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/20 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.masterOnly && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                  MASTER
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-3 shrink-0">
          <div className="px-3 py-2 mb-1">
            <p className="text-[11px] text-slate-500">Logado como</p>
            <p className="text-sm font-semibold truncate leading-tight mt-0.5">{profile?.name ?? '…'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {roleLabel}
              {profile?.municipio ? ` · ${profile.municipio}` : ''}
            </p>
          </div>
          <button
            onClick={() => { signOut(); onClose?.(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
