import { useState } from 'react';
import { Bell, Menu, Plus } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { GlobalCustomerSearch } from '@/components/GlobalCustomerSearch';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';

export function LegacyConsoleShell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();
  return <div className="flex min-h-screen bg-slate-50"><Sidebar open={open} onClose={() => setOpen(false)} /><div className="min-w-0 flex-1"><header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur"><div className="flex min-h-16 items-center gap-3 px-4 lg:px-8"><button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button><div className="min-w-0 flex-1"><GlobalCustomerSearch /></div><button aria-label="Alertas" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Bell className="h-5 w-5" /></button>{can('customer.write') && <button onClick={() => navigate('/app/clientes?novo=1')} className="hidden items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white sm:flex"><Plus className="h-4 w-4" />Novo cliente</button>}</div></header><main className="p-4 lg:p-8"><Outlet /></main></div></div>;
}
