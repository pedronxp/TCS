import { useEffect, useState } from 'react';
import { Bell, Menu, Plus } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { GlobalCustomerSearch } from './GlobalCustomerSearch';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

const titleFor = (pathname: string) => pathname === '/' ? 'Visão geral' : pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part).replace(/-/g, ' ')).join(' / ');
export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const title = titleFor(pathname);
  useEffect(() => { document.title = `${title} — TCS Console`; }, [title]);
  return <div className="flex min-h-screen bg-slate-50"><Sidebar open={open} onClose={() => setOpen(false)} /><div className="min-w-0 flex-1"><header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur"><div className="flex min-h-16 items-center gap-3 px-4 lg:px-8"><button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden min-w-40 md:block"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">TCS Console</p><h1 className="truncate text-sm font-semibold capitalize text-slate-900">{title}</h1></div><div className="min-w-0 flex-1"><GlobalCustomerSearch /></div><span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 xl:inline">{import.meta.env.MODE}</span><button aria-label="Alertas" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Bell className="h-5 w-5" /></button>{can('customer.write') && <button onClick={() => navigate('/clientes?novo=1')} className="hidden items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:flex"><Plus className="h-4 w-4" />Novo cliente</button>}</div></header><main className="p-4 lg:p-8"><Outlet /></main></div></div>;
}
