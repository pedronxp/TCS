import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { OrganizationFormDialog } from '@/components/customers/OrganizationFormDialog';
import { IndividualClientDialog } from '@/components/customers/IndividualClientDialog';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui/AsyncState';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomers } from '@/hooks/useCustomers';

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useCustomers(search, status, page);
  const newCustomer = params.get('novo');
  const creatingOrganization = (newCustomer === '1' || newCustomer === 'municipal') && can('customer.write');
  const creatingIndividual = newCustomer === 'individual' && can('customer.write');
  const closeCreate = () => { params.delete('novo'); setParams(params, { replace: true }); };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-2xl font-bold text-slate-950">Clientes</h2><p className="mt-1 text-sm text-slate-500">Organizações e contas individuais em uma visão comercial, operacional e técnica.</p></div>
        {can('customer.write') && <div className="flex flex-wrap gap-2"><button onClick={() => setParams({ novo: 'municipal' })} className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Plus className="h-4 w-4" />Cliente municipal</button><button onClick={() => setParams({ novo: 'individual' })} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Plus className="h-4 w-4" />Cliente individual</button></div>}
      </div>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row">
        <label className="relative flex-1"><span className="sr-only">Buscar clientes</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Nome, município, contato ou identificador" className="h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} aria-label="Filtrar status" className="h-9 rounded-lg border px-3 text-sm"><option value="">Todos os status</option>{['onboarding', 'pilot', 'active', 'suspended', 'archived'].map((value) => <option key={value}>{value}</option>)}</select>
      </div>
      {query.isLoading ? <LoadingState label="Carregando clientes…" /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <EmptyState title="Nenhum cliente encontrado" description="Ajuste os filtros ou crie o primeiro cliente para iniciar a implantação." /> : <><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Cliente</th><th className="p-4">Plano</th><th className="p-4">Assinatura</th><th className="p-4">Usuários</th><th className="p-4">Atividade</th><th className="p-4">Status</th></tr></thead><tbody>{query.data.items.map((customer) => <tr key={customer.customer_id} className="border-t hover:bg-slate-50"><td className="p-4"><Link className="font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" to={`/clientes/${encodeURIComponent(customer.customer_id)}`}>{customer.display_name}</Link><p className="text-xs text-slate-500">{customer.municipality_name || customer.kind}{customer.state_code ? ` · ${customer.state_code}` : ''}</p></td><td className="p-4">{customer.plan_name || 'Sem plano'}</td><td className="p-4"><StatusBadge value={customer.subscription_status} /></td><td className="p-4">{customer.active_users}</td><td className="p-4">{customer.last_activity_at ? new Date(customer.last_activity_at).toLocaleDateString('pt-BR') : '—'}</td><td className="p-4"><StatusBadge value={customer.status} /></td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>{query.data.total} cliente(s)</span><div className="flex gap-2"><button disabled={page === 0} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior" className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button disabled={(page + 1) * query.data.limit >= query.data.total} onClick={() => setPage((value) => value + 1)} aria-label="Próxima página" className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div></>}
      <OrganizationFormDialog open={creatingOrganization} onClose={closeCreate} onSaved={(customerId) => navigate(`/clientes/${encodeURIComponent(customerId)}`)} />
      <IndividualClientDialog open={creatingIndividual} onClose={closeCreate} onSaved={(customerId) => navigate(`/clientes/${encodeURIComponent(customerId)}`)} />
    </section>
  );
}
