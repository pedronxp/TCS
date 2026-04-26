import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Calendar,
  Map,
  FileText,
  BarChart3,
  Archive,
  Smartphone,
  Settings,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  masterOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Visão Geral', icon: LayoutDashboard },
  { to: '/ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
  { to: '/usuarios', label: 'Usuários', icon: Users },
  { to: '/agendamentos', label: 'Agendamentos', icon: Calendar },
  { to: '/mapa', label: 'Mapa', icon: Map },
  { to: '/laudos', label: 'Laudos', icon: FileText },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/arquivamento', label: 'Arquivamento', icon: Archive, masterOnly: true },
  { to: '/builds', label: 'Builds APK', icon: Smartphone, masterOnly: true },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, masterOnly: true },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const isMaster = profile?.role === 'master_admin';

  const visibleNav = NAV.filter((item) => !item.masterOnly || isMaster);

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img
            src="/app-icon.png"
            alt="TCS"
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div>
            <h1 className="font-bold text-sm leading-tight">TCS</h1>
            <p className="text-xs text-slate-400 leading-tight">Painel Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/20 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
            {item.masterOnly && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                MASTER
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-slate-400">Logado como</p>
          <p className="text-sm font-medium truncate">{profile?.name ?? 'Carregando...'}</p>
          <p className="text-xs text-slate-400">
            {profile?.role === 'master_admin' ? 'Master Admin' : 'Admin'}
            {profile?.municipio ? ` · ${profile.municipio}` : ''}
          </p>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
