import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, GitBranch, Plus, Rocket } from 'lucide-react';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { StatusBadge } from '@/components/domain/Badges';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type VersionRow = {
  version: string;
  status: string;
  changelog: string;
  published_at: string | null;
  updated_at: string;
  adoption: number;
};

type ReleaseAction = 'set_development' | 'publish' | 'set_minimum';

export function VersionsPage() {
  const { can, user, profile } = useAuth();
  const canPrepare = can('configuration.prepare') || can('configuration.publish');
  const [editing, setEditing] = useState(false);
  const [notesVersion, setNotesVersion] = useState<VersionRow | null>(null);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<ReleaseAction>('set_development');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['release-catalog', user?.id, profile?.role],
    queryFn: async () => {
      const [versions, settings, events] = await Promise.all([
        supabase
          .from('internal_app_versions')
          .select('version,status,changelog,published_at,updated_at')
          .order('updated_at', { ascending: false }),
        supabase
          .from('internal_release_settings')
          .select('published_version,minimum_version,development_version,updated_at')
          .single(),
        supabase.from('technical_events').select('app_version').not('app_version', 'is', null).limit(5000),
      ]);
      const firstError = versions.error || settings.error || events.error;
      if (firstError) throw firstError;
      const counts = new Map<string, number>();
      for (const event of events.data || []) {
        if (event.app_version) counts.set(event.app_version, (counts.get(event.app_version) || 0) + 1);
      }
      return {
        settings: settings.data,
        rows: (versions.data || []).map((row): VersionRow => ({
          ...row,
          adoption: counts.get(row.version) || 0,
        })),
      };
    },
  });

  const mutation = useAdministrativeMutation<{
    action: ReleaseAction;
    version: string;
    changelog: string;
    reason: string;
  }, unknown>({
    mutationFn: async (input, operationId) => {
      const { data, error: rpcError } = await supabase.rpc('mutate_internal_release', {
        p_action: input.action,
        p_version: input.version,
        p_changelog: input.changelog,
        p_reason: input.reason,
        p_operation_id: operationId,
      });
      if (rpcError) throw rpcError;
      return data;
    },
    invalidate: [['release-catalog'], ['internal-dashboard']],
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  const totalAdoption = useMemo(() => rows.reduce((sum, row) => sum + row.adoption, 0), [rows]);
  const published = rows.find((row) => row.version === query.data?.settings.published_version);
  const minimum = rows.find((row) => row.version === query.data?.settings.minimum_version);
  const development = rows.find((row) => row.version === query.data?.settings.development_version);
  const adoptionPercent = totalAdoption && published
    ? Math.round(published.adoption * 100 / totalAdoption)
    : 0;
  const belowMinimumCount = rows
    .filter((row) => compareVersions(row.version, query.data?.settings.minimum_version || '') < 0)
    .reduce((sum, row) => sum + row.adoption, 0);

  function openEditor() {
    setAction('set_development');
    setVersion(query.data?.settings.development_version || '');
    setChangelog(development?.changelog || '');
    setReason('');
    setError(null);
    setConfirming(false);
    setEditing(true);
  }

  function closeEditor() {
    if (mutation.isPending) return;
    setEditing(false);
    setConfirming(false);
    setError(null);
  }

  async function requestConfirmation() {
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version.trim())) {
      setError('Informe uma versão semântica válida.');
      return;
    }
    if (action === 'set_development' && reason.trim().length < 8) {
      setError('Informe uma justificativa com pelo menos 8 caracteres.');
      return;
    }
    setError(null);
    if (action !== 'set_development') {
      setConfirming(true);
      return;
    }
    try {
      await applyRelease(reason.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a versão.');
    }
  }

  async function applyRelease(auditReason: string) {
    const result = await mutation.mutateAsync({ action, version: version.trim(), changelog, reason: auditReason });
    if (!result.ok) throw new Error(result.error);
    setConfirming(false);
    setEditing(false);
    setVersion('');
    setChangelog('');
    setReason('');
  }

  return (
    <section className="page-stack max-w-[1094px]" aria-labelledby="versions-title">
      <form
        id="versions-create-form"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          if (canPrepare) openEditor();
        }}
      />

      <header>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Release management</p>
        <h1 id="versions-title" className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Versões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma trilha clara entre desenvolvimento, homologação e produção.
        </p>
        {canPrepare && (
          <Button className="mt-4 sm:hidden" onClick={openEditor}>
            <Plus />
            Nova versão
          </Button>
        )}
      </header>

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !rows.length)}
        emptyTitle="Sem versões"
        emptyDescription="Cadastre a primeira versão de desenvolvimento."
      >
        {query.data && (
          <>
            <ReleaseTrain
              development={query.data.settings.development_version}
              minimum={query.data.settings.minimum_version}
              published={query.data.settings.published_version}
            />

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_248px]">
              <div className="grid gap-4 md:grid-cols-3">
                <VersionSummaryCard
                  label="Publicada"
                  version={published || fallbackVersion(query.data.settings.published_version, 'published')}
                  onOpen={setNotesVersion}
                />
                <VersionSummaryCard
                  label="Mínima suportada"
                  version={minimum || fallbackVersion(query.data.settings.minimum_version, 'retired')}
                  onOpen={setNotesVersion}
                />
                <VersionSummaryCard
                  label="Desenvolvimento"
                  version={development || fallbackVersion(query.data.settings.development_version, 'development')}
                  onOpen={setNotesVersion}
                />
              </div>

              <AdoptionPanel
                publishedVersion={query.data.settings.published_version}
                publishedCount={published?.adoption || 0}
                minimumVersion={query.data.settings.minimum_version}
                minimumCount={minimum?.adoption || 0}
                percent={adoptionPercent}
                belowMinimum={belowMinimumCount}
              />
            </div>

            <CandidateChanges
              version={development || fallbackVersion(query.data.settings.development_version, 'development')}
            />
          </>
        )}
      </AsyncBoundary>

      <Dialog open={editing && !confirming} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar catálogo de versões</DialogTitle>
            <DialogDescription>
              A operação preserva o changelog e cria um registro auditável.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="release-action">Operação</Label>
              <select
                id="release-action"
                value={action}
                onChange={(event) => setAction(event.target.value as ReleaseAction)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
              >
                <option value="set_development">Definir em desenvolvimento</option>
                {can('configuration.publish') && (
                  <>
                    <option value="publish">Publicar versão</option>
                    <option value="set_minimum">Definir versão mínima</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="release-version">Versão</Label>
              <Input
                id="release-version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="2.18.0-rc.3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="release-changelog">Changelog</Label>
              <Textarea
                id="release-changelog"
                value={changelog}
                onChange={(event) => setChangelog(event.target.value)}
                rows={6}
                placeholder="Uma mudança por linha"
              />
            </div>
            {action === 'set_development' ? (
              <div className="space-y-2">
                <Label htmlFor="release-reason">Justificativa auditada</Label>
                <Textarea
                  id="release-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="Explique por que esta versão deve entrar em desenvolvimento"
                />
              </div>
            ) : null}
            {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancelar</Button>
            <Button disabled={mutation.isPending} onClick={() => void requestConfirmation()}>
              {action === 'set_development' ? 'Salvar desenvolvimento' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title="Confirmar alteração de versão"
        description="Publicação e versão mínima exigem permissão de publicação, MFA e justificativa auditada."
        confirmLabel="Aplicar versão"
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          await applyRelease(reason);
        }}
      />

      <Dialog open={Boolean(notesVersion)} onOpenChange={(open) => !open && setNotesVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas da versão {notesVersion?.version}</DialogTitle>
            <DialogDescription>
              Changelog persistido no catálogo interno.
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap rounded-xl bg-secondary p-4 text-sm leading-6">
            {notesVersion?.changelog || 'Nenhuma nota registrada.'}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ReleaseTrain({ development, minimum, published }: { development: string; minimum: string; published: string }) {
  const stages = [
    { number: 1, label: 'Desenvolvimento', value: development, tone: 'bg-muted text-foreground' },
    { number: 2, label: 'Mínima suportada', value: minimum, tone: 'bg-muted text-foreground' },
    { number: 3, label: 'Produção', value: published, tone: 'bg-primary text-primary-foreground' },
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-6" aria-labelledby="release-train-title">
      <p id="release-train-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Release train</p>
      <div className="mt-7 grid gap-6 md:grid-cols-3">
        {stages.map((stage, index) => (
          <div key={stage.label} className="relative">
            {index < stages.length - 1 && (
              <span className="absolute left-[64px] top-6 hidden h-px w-[calc(100%-48px)] bg-border md:block" aria-hidden="true" />
            )}
            <div className="relative z-10 flex items-center gap-4">
              <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full text-xs font-bold', stage.tone)}>
                {stage.number}
              </span>
              <strong className="truncate text-base">{stage.value || '—'}</strong>
            </div>
            <p className="mt-3 pl-1 text-[11px] text-muted-foreground">{stage.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VersionSummaryCard({
  label,
  version,
  onOpen,
}: {
  label: string;
  version: VersionRow;
  onOpen: (version: VersionRow) => void;
}) {
  return (
    <Card className="min-h-[158px] shadow-none">
      <CardContent className="flex h-full flex-col p-4">
        <StatusBadge value={version.status} />
        <strong className="mt-5 text-[22px]">{version.version || '—'}</strong>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {label} · {version.adoption} {version.adoption === 1 ? 'evento' : 'eventos'}
        </p>
        <button className="mt-auto flex items-center gap-1 pt-4 text-left text-xs font-bold text-primary" onClick={() => onOpen(version)}>
          Abrir notas <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </CardContent>
    </Card>
  );
}

function AdoptionPanel({
  publishedVersion,
  publishedCount,
  minimumVersion,
  minimumCount,
  percent,
  belowMinimum,
}: {
  publishedVersion: string;
  publishedCount: number;
  minimumVersion: string;
  minimumCount: number;
  percent: number;
  belowMinimum: number;
}) {
  return (
    <aside className="rounded-lg border border-border bg-muted p-6" aria-labelledby="adoption-title">
      <p id="adoption-title" className="text-[10px] font-bold uppercase tracking-wider text-primary">Adoção observada</p>
      <strong className="mt-5 block text-[30px]">{percent}%</strong>
      <p className="text-[11px] text-muted-foreground">dos eventos na versão publicada</p>
      <dl className="mt-8 space-y-6 text-xs">
        <AdoptionRow label={publishedVersion} value={publishedCount} />
        <AdoptionRow label={minimumVersion} value={minimumCount} />
        <AdoptionRow label="Abaixo da mínima" value={belowMinimum} />
      </dl>
    </aside>
  );
}

function AdoptionRow({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-4"><dt className="font-semibold">{label || '—'}</dt><dd className="font-bold text-foreground">{value}</dd></div>;
}

function CandidateChanges({ version }: { version: VersionRow }) {
  const entries = changelogEntries(version.changelog);
  return (
    <Card className="shadow-none">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Changelog persistido</p>
            <h2 className="mt-1 text-[17px] font-bold">Mudanças em desenvolvimento</h2>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{version.version || '—'}</span>
        </div>
        {entries.length ? (
          <ul className="mt-5 divide-y">
            {entries.map((entry, index) => (
              <li key={`${entry.text}-${index}`} className="grid min-h-14 grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-3 sm:grid-cols-[92px_minmax(0,1fr)_auto]">
                <ChangeBadge kind={entry.kind} />
                <span className="text-sm font-semibold">{entry.text}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">linha {index + 1}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" aria-hidden="true" />
            Nenhuma mudança registrada para esta versão.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeBadge({ kind }: { kind: ReturnType<typeof classifyChange> }) {
  const styles = {
    new: 'bg-info-soft text-foreground',
    improvement: 'bg-secondary text-foreground',
    fix: 'bg-destructive-soft text-foreground',
    security: 'bg-warning-soft text-foreground',
  };
  const labels = { new: 'Novo', improvement: 'Melhoria', fix: 'Correção', security: 'Segurança' };
  const Icon = kind === 'new' ? Rocket : CheckCircle2;
  return (
    <span className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold', styles[kind])}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {labels[kind]}
    </span>
  );
}

function fallbackVersion(version: string, status: string): VersionRow {
  return { version, status, changelog: '', published_at: null, updated_at: '', adoption: 0 };
}

function compareVersions(left: string, right: string) {
  const parse = (value: string) => value.split(/[+-]/, 1)[0].split('.').map((part) => Number(part));
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function changelogEntries(changelog: string) {
  return changelog
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .map((text) => ({ text, kind: classifyChange(text) }));
}

function classifyChange(text: string): 'new' | 'improvement' | 'fix' | 'security' {
  const normalized = text.toLocaleLowerCase('pt-BR');
  if (/seguran|mfa|auth|permiss/.test(normalized)) return 'security';
  if (/corrig|correç|fix|falha|erro/.test(normalized)) return 'fix';
  if (/novo|nova|adicion|inclu/.test(normalized)) return 'new';
  return 'improvement';
}
