import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { Input } from '@/components/ui/Input';
import { iaApi } from '@/lib/ia';
import { useAuth } from '@/contexts/AuthContext';
import { IaNav } from './IaNav';

interface ModuleRow { organization_id: string; org: string; module_key: string; enabled: boolean }
interface ModulesMatrix { modules: string[]; rows: ModuleRow[]; orgs: { id: string; name: string }[] }

export function IaAcessosPage() {
  const { can } = useAuth();
  const mayManage = can('ia.manage');
  const queryClient = useQueryClient();
  const [orgQuery, setOrgQuery] = useState('');

  const matrix = useQuery<ModulesMatrix>({ queryKey: ['ia', 'modules'], queryFn: () => iaApi.modulesMatrix() });

  const toggle = useMutation({
    mutationFn: (input: { org: string; module: string; enabled: boolean }) =>
      iaApi.moduleSet(input.org, input.module, input.enabled),
    onSuccess: () => {
      toast.success('Permissão de módulo atualizada.');
      void queryClient.invalidateQueries({ queryKey: ['ia', 'modules'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredOrgs = useMemo(() => {
    const q = orgQuery.trim().toLowerCase();
    return (matrix.data?.orgs ?? []).filter((o) => !q || o.name.toLowerCase().includes(q));
  }, [matrix.data, orgQuery]);

  const enabledMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of matrix.data?.rows ?? []) map.set(`${row.organization_id}:${row.module_key}`, row.enabled);
    return map;
  }, [matrix.data]);

  if (matrix.isLoading) return <LoadingState label="Carregando matriz de acesso" />;
  if (matrix.isError || !matrix.data) return <ErrorState error="Não foi possível carregar" onRetry={() => void matrix.refetch()} />;

  const modules = matrix.data.modules;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Liberação do projeto</h1>
          <p className="text-sm text-muted-foreground">
            Visão única: módulos do sistema por organização + atalhos para os outros níveis de permissão.
          </p>
        </div>
      </header>

      <IaNav />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Níveis de permissão do sistema</CardTitle>
          <CardDescription>Cada nível tem sua própria tela de gestão.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Link to="/app/staff" className="rounded-lg border p-4 transition-colors hover:bg-secondary">
            <p className="font-medium">👥 Equipe interna</p>
            <p className="mt-1 text-xs text-muted-foreground">Quem da sua equipe acessa o console e com quais permissões (inclui IA).</p>
          </Link>
          <Link to="/app/ia/rollout" className="rounded-lg border p-4 transition-colors hover:bg-secondary">
            <p className="font-medium">🤖 Funcionalidades de IA</p>
            <p className="mt-1 text-xs text-muted-foreground">Checkbox por organização ou usuário, com estágios de validação.</p>
          </Link>
          <Link to="/app/clientes" className="rounded-lg border p-4 transition-colors hover:bg-secondary">
            <p className="font-medium">🏛️ Papéis dentro das organizações</p>
            <p className="mt-1 text-xs text-muted-foreground">Master, admin, supervisor e agente de cada município.</p>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Módulos por organização</CardTitle>
              <CardDescription>Marque para liberar o módulo inteiro para a organização.</CardDescription>
            </div>
            <Input
              value={orgQuery}
              onChange={(e) => setOrgQuery(e.target.value)}
              placeholder="Filtrar organização…"
              className="max-w-xs"
              aria-label="Filtrar organização"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {modules.length === 0 ? (
            <EmptyState title="Nenhum módulo configurado" description="Os módulos aparecerão aqui quando houver organizações com configuração." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4">Organização</th>
                  {modules.map((m) => <th key={m} className="pb-2 pr-4 text-center">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr key={org.id} className="border-t">
                    <td className="py-2.5 pr-4 font-medium">{org.name}</td>
                    {modules.map((m) => (
                      <td key={m} className="text-center">
                        <Checkbox
                          checked={enabledMap.get(`${org.id}:${m}`) ?? false}
                          disabled={!mayManage || toggle.isPending}
                          aria-label={`Módulo ${m} para ${org.name}`}
                          onCheckedChange={(checked) => toggle.mutate({ org: org.id, module: m, enabled: checked === true })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
