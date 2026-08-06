import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui/AsyncState';
import { supabase } from '@/lib/supabase';

export function OrganizationsPage() {
  const query = useQuery({
    queryKey: ['organizations-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id,display_name,municipality_name,state_code,status,contact_name,contact_email,organization_members(id),organization_onboarding(pilot_started_at,review_due_at)')
        .order('display_name');
      if (error) throw error;
      return data;
    },
  });
  if (query.isLoading) return <LoadingState label="Carregando organizações…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data?.length) return <EmptyState title="Nenhuma organização" description="Crie o primeiro cliente municipal pela área Clientes." />;
  return <section><div className="mb-5"><h2 className="text-2xl font-bold">Organizações</h2><p className="mt-1 text-sm text-muted-foreground">Prefeituras, contatos, implantação e agentes.</p></div><div className="grid gap-4 lg:grid-cols-2">{query.data.map((organization) => <Link to={`/clientes/${encodeURIComponent(`organization:${organization.id}`)}`} key={organization.id} className="rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{organization.display_name}</h3><p className="text-xs text-muted-foreground">{organization.municipality_name || 'Município não informado'} {organization.state_code && `· ${organization.state_code}`}</p></div><StatusBadge value={organization.status} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Agentes</p><b>{organization.organization_members.length}</b></div><div><p className="text-xs text-muted-foreground">Contato</p><b>{organization.contact_name || '—'}</b></div></div><p className="mt-3 text-xs text-muted-foreground">{organization.contact_email || 'Sem e-mail'} · revisão {organization.organization_onboarding?.review_due_at ? new Date(organization.organization_onboarding.review_due_at).toLocaleDateString('pt-BR') : 'não agendada'}</p></Link>)}</div></section>;
}
