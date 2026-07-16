import { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '@/hooks/useCustomers';

export function GlobalCustomerSearch() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const query = useCustomers(value, '', 0, 6);
  const open = value.trim().length >= 2;

  return <div className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Buscar cliente…" aria-label="Buscar cliente" className="h-9 w-full rounded-lg border bg-slate-50 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />{open && <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border bg-white shadow-xl" role="listbox">{query.isLoading ? <p className="p-3 text-sm text-slate-500">Buscando…</p> : query.data?.items.length ? query.data.items.map((customer) => <button key={customer.customer_id} role="option" onClick={() => { navigate(`/clientes/${encodeURIComponent(customer.customer_id)}`); setValue(''); }} className="block w-full border-b px-4 py-3 text-left last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"><span className="block text-sm font-semibold">{customer.display_name}</span><span className="block text-xs text-slate-500">{customer.municipality_name || customer.kind} · {customer.plan_name || 'sem plano'}</span></button>) : <p className="p-3 text-sm text-slate-500">Nenhum cliente encontrado.</p>}</div>}</div>;
}
