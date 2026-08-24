import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, UserCog, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalRestrictionMessage } from '@/lib/portal';

export function PortalTeamPage() {
  const { access, can } = usePortalAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('active');
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'equipe', access?.userId, access?.accountKind, access?.organizationId ?? null],
    queryFn: () => fetchPortalWorkspace('equipe'),
  });
  const mayManage = can('team.manage') && Boolean(access?.creationAllowed);
  const items = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (query.data?.items ?? []).filter((item) => {
      if (role !== 'all' && String(item.subtitle) !== role) return false;
      if (status !== 'all' && String(item.status) !== status) return false;
      return !term || [item.title, item.subtitle, item.status].some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term));
    });
  }, [query.data?.items, role, search, status]);

  return (
    <div className="page-stack mx-auto max-w-[1050px]">
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Administração municipal</p><h1 className="mt-1 text-2xl font-semibold">Equipe</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Consulte pessoas e abra uma página dedicada para revisar perfil, situação e permissões.</p></header>
      {can('team.manage') && !access?.creationAllowed && <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm" role="status">Gestão em consulta: {portalRestrictionMessage(access?.restrictionCause ?? null)}</p>}
      <Card><CardContent className="grid gap-3 p-3 md:grid-cols-[minmax(260px,1fr)_180px_180px]">
        <label className="relative"><span className="sr-only">Buscar pessoa</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="h-11 pl-9 pr-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, perfil ou situação" />{search && <Button type="button" variant="ghost" size="icon" onClick={() => setSearch('')} className="absolute right-2 top-1.5 h-8 w-8" aria-label="Limpar busca"><X className="h-4 w-4" /></Button>}</label>
        <label className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><span className="sr-only">Filtrar por perfil</span><select className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">Todos os perfis</option><option value="master">Master</option><option value="admin">Administrador</option><option value="supervisor">Supervisor</option><option value="agent">Agente</option></select></label>
        <label><span className="sr-only">Filtrar por situação</span><select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todas as situações</option><option value="active">Ativos</option><option value="invited">Convidados</option><option value="suspended">Suspensos</option><option value="removed">Removidos</option></select></label>
      </CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Pessoas da organização</CardTitle><Badge variant="outline">{items.length} resultado{items.length === 1 ? '' : 's'}</Badge></CardHeader><CardContent>
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando equipe…</p>}
        {query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar a equipe.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
        <ul className="divide-y">{items.map((item) => <li key={String(item.id)} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold">{String(item.title)}</p><div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant="outline">{roleLabel(String(item.subtitle))}</Badge><Badge>{statusLabel(String(item.status))}</Badge></div></div><Button asChild variant="outline" size="sm"><Link to={`/portal/municipal/equipe/${String(item.id)}`}><UserCog />{mayManage && String(item.user_id) !== access?.userId ? 'Gerenciar' : 'Visualizar'}</Link></Button></li>)}</ul>
        {!query.isLoading && items.length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma pessoa corresponde aos filtros.</p>}
      </CardContent></Card>
    </div>
  );
}

export function roleLabel(value: string) { return ({ master: 'Master', admin: 'Administrador', supervisor: 'Supervisor', agent: 'Agente' } as Record<string, string>)[value] ?? value; }
export function statusLabel(value: string) { return ({ active: 'Ativo', suspended: 'Suspenso', removed: 'Removido', invited: 'Convidado' } as Record<string, string>)[value] ?? value; }
