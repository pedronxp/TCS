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
  return <div className="flex min-h-screen bg-background"><Sidebar open={open} onClose={() => setOpen(false)} /><div className="min-w-0 flex-1"><header className="glass sticky top-0 z-30 border-b border-border"><div className="flex min-h-16 items-center gap-3 px-4 lg:px-8"><button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 hover:bg-secondary lg:hidden"><Menu className="h-5 w-5" /></button><div className="min-w-0 flex-1"><GlobalCustomerSearch /></div><button aria-label="Alertas" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Bell className="h-5 w-5" /></button>{can('customer.write') && <button onClick={() => navigate('/app/clientes?novo=1')} className="bg-primary hover:bg-primary-hover hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground sm:flex"><Plus className="h-4 w-4" />Novo cliente</button>}</div></header><main className="p-4 lg:p-8"><Outlet /></main></div></div>;
}
