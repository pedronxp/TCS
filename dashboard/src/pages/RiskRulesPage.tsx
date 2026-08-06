import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Braces,
  CheckCircle2,
  FlaskConical,
  History,
  Plus,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { StatusBadge } from '@/components/domain/Badges';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/supabase';

const defaultConfig: Json = [
  { nivel: 'r1', label: 'Risco baixo', descricao: 'Monitoramento preventivo', minPontos: 0, maxPontos: 24 },
  { nivel: 'r2', label: 'Risco moderado', descricao: 'Vistoria técnica necessária', minPontos: 25, maxPontos: 49 },
  { nivel: 'r3', label: 'Risco alto', descricao: 'Laudo técnico obrigatório', minPontos: 50, maxPontos: 74 },
  { nivel: 'r4', label: 'Risco crítico', descricao: 'Avaliar interdição imediata', minPontos: 75, maxPontos: 9999 },
];

interface RiskVersion {
  version: number;
  status: string;
  configuration: Json;
  reason: string;
  createdAt: string;
}

interface RiskConfig {
  municipality: string;
  published: Json;
  updatedAt: string | null;
  versions: RiskVersion[];
}

interface RiskTier {
  level: 'R1' | 'R2' | 'R3' | 'R4';
  label: string;
  description: string;
  min: number;
  max: number;
}

function parse(value: Json | null): RiskConfig[] {
  return jsonArray(value).map(jsonObject).filter(Boolean).map((row) => ({
    municipality: jsonString(row?.municipality) || '',
    published: row?.published ?? [],
    updatedAt: jsonString(row?.updated_at),
    versions: jsonArray(row?.versions).map(jsonObject).filter(Boolean).map((version) => ({
      version: jsonNumber(version?.version) || 0,
      status: jsonString(version?.status) || 'draft',
      configuration: version?.configuration ?? [],
      reason: jsonString(version?.reason) || '',
      createdAt: jsonString(version?.created_at) || new Date(0).toISOString(),
    })),
  }));
}

export function RiskRulesPage() {
  const { can } = useAuth();
  const [municipality, setMunicipality] = useState('');
  const [config, setConfig] = useState(JSON.stringify(defaultConfig, null, 2));
  const [action, setAction] = useState<'save_draft' | 'publish' | 'rollback'>('save_draft');
  const [targetVersion, setTargetVersion] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [score, setScore] = useState('35');
  const [simulation, setSimulation] = useState<Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const query = useQuery({
    queryKey: ['risk-configs'],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.rpc('list_internal_risk_configs');
      if (queryError) throw queryError;
      return parse(data);
    },
  });

  useEffect(() => {
    if (initialized || !query.data?.length) return;
    const first = query.data[0];
    setMunicipality(first.municipality);
    setConfig(JSON.stringify(currentConfiguration(first), null, 2));
    setInitialized(true);
  }, [initialized, query.data]);

  const selected = useMemo(
    () => query.data?.find((item) => item.municipality === municipality) || null,
    [municipality, query.data],
  );
  const tiers = useMemo(() => {
    try {
      return parseTiers(JSON.parse(config) as Json);
    } catch {
      return [];
    }
  }, [config]);
  const simulationRow = jsonObject(simulation);
  const simulatedLevel = normalizeLevel(jsonString(simulationRow?.nivel));

  const mutation = useAdministrativeMutation<{
    municipality: string;
    action: string;
    configuration: Json;
    targetVersion: number | null;
    reason: string;
  }, unknown>({
    mutationFn: async (input, operationId) => {
      const { data, error: mutationError } = await supabase.rpc('mutate_internal_risk_config', {
        p_municipality: input.municipality,
        p_action: input.action,
        p_configuration: input.configuration,
        p_target_version: input.targetVersion ?? 0,
        p_reason: input.reason,
        p_operation_id: operationId,
      });
      if (mutationError) throw mutationError;
      return data;
    },
    invalidate: [['risk-configs'], ['audit-timeline']],
  });

  function readConfig() {
    const parsed = JSON.parse(config) as Json;
    if (!Array.isArray(parsed) || parsed.length < 2) {
      throw new Error('A configuração deve ser um array com pelo menos dois níveis.');
    }
    if (parseTiers(parsed).length !== parsed.length) {
      throw new Error('Todos os níveis precisam informar faixa, rótulo e identificador R1–R4.');
    }
    return parsed;
  }

  async function simulate() {
    setError(null);
    try {
      const numericScore = Number(score);
      if (!Number.isFinite(numericScore)) throw new Error('Informe uma pontuação válida.');
      const { data, error: rpcError } = await supabase.rpc('simulate_internal_risk_config', {
        p_configuration: readConfig(),
        p_score: numericScore,
      });
      if (rpcError) throw rpcError;
      setSimulation(data);
    } catch (cause) {
      setSimulation(null);
      setError(cause instanceof Error ? cause.message : 'A simulação falhou.');
    }
  }

  function selectMunicipality(item: RiskConfig) {
    setMunicipality(item.municipality);
    setConfig(JSON.stringify(currentConfiguration(item), null, 2));
    setSimulation(null);
    setTargetVersion(null);
    setError(null);
  }

  function createConfiguration() {
    setMunicipality('');
    setConfig(JSON.stringify(defaultConfig, null, 2));
    setSimulation(null);
    setTargetVersion(null);
    setError(null);
  }

  return (
    <section className="page-stack max-w-[1094px]" aria-labelledby="risk-rules-title">
      <form
        id="risk-create-form"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          if (can('configuration.prepare') || can('configuration.publish')) createConfiguration();
        }}
      />

      <header>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Governança de risco</p>
        <h1 id="risk-rules-title" className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Regras de risco</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure faixas por município, simule o resultado e publique com segurança.
        </p>
        {(can('configuration.prepare') || can('configuration.publish')) && (
          <Button className="mt-4 sm:hidden" onClick={createConfiguration}>
            <Plus />
            Nova configuração
          </Button>
        )}
      </header>

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={false}
      >
        {query.data && (
          <>
            <SimulationHero
              score={score}
              onScoreChange={setScore}
              onSimulate={() => void simulate()}
              simulation={simulation}
              level={simulatedLevel}
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[300px_404px_350px]">
              <MunicipalityPanel
                items={query.data}
                selected={municipality}
                canCreate={can('configuration.prepare') || can('configuration.publish')}
                onSelect={selectMunicipality}
                onCreate={createConfiguration}
                onNameChange={(value) => {
                  setMunicipality(value);
                  setSimulation(null);
                }}
              />

              <TierPanel
                municipality={municipality}
                selected={selected}
                tiers={tiers}
                config={config}
                advancedOpen={advancedOpen}
                onAdvancedOpenChange={setAdvancedOpen}
                onConfigChange={(value) => {
                  setConfig(value);
                  setSimulation(null);
                  setTargetVersion(null);
                }}
              />

              <VersionPanel
                municipality={municipality}
                selected={selected}
                simulationReady={Boolean(simulation)}
                canPrepare={can('configuration.prepare')}
                canPublish={can('configuration.publish')}
                targetVersion={targetVersion}
                onSaveDraft={() => {
                  setAction('save_draft');
                  setTargetVersion(null);
                  setConfirming(true);
                }}
                onPublish={() => {
                  setAction('publish');
                  setTargetVersion(null);
                  setConfirming(true);
                }}
                onSelectVersion={(version) => {
                  setConfig(JSON.stringify(version.configuration, null, 2));
                  setAction('rollback');
                  setTargetVersion(version.version);
                  setSimulation(null);
                  setError(null);
                }}
                onRollback={() => {
                  setAction('rollback');
                  setConfirming(true);
                }}
              />
            </div>

          </>
        )}
      </AsyncBoundary>

      {error && <p className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>}

      <HighRiskDialog
        open={confirming}
        title={action === 'publish' ? 'Publicar regras de risco' : action === 'rollback' ? 'Restaurar regras de risco' : 'Salvar rascunho de risco'}
        description="A configuração simulada será versionada e registrada na auditoria."
        confirmLabel={action === 'save_draft' ? 'Salvar rascunho' : action === 'rollback' ? `Restaurar v${targetVersion}` : 'Publicar configuração'}
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          const result = await mutation.mutateAsync({
            municipality: municipality.trim(),
            action,
            configuration: readConfig(),
            targetVersion,
            reason,
          });
          if (!result.ok) throw new Error(result.error);
          setConfirming(false);
          setTargetVersion(null);
        }}
      />
    </section>
  );
}

function SimulationHero({
  score,
  onScoreChange,
  onSimulate,
  simulation,
  level,
}: {
  score: string;
  onScoreChange: (value: string) => void;
  onSimulate: () => void;
  simulation: Json | null;
  level: RiskTier['level'] | null;
}) {
  const row = jsonObject(simulation);
  return (
    <section className="grid min-h-[156px] gap-5 rounded-lg border border-border bg-muted p-6 lg:grid-cols-[minmax(0,1fr)_188px_366px] lg:items-center" aria-labelledby="simulation-title">
      <div>
        <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">Obrigatória</span>
        <h2 id="simulation-title" className="mt-3 text-lg font-bold">Simule antes de publicar</h2>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          A publicação só é liberada após a configuração atual produzir uma classificação válida.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Label htmlFor="risk-score" className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pontuação</Label>
        <div className="mt-1 flex items-end gap-2">
          <Input
            id="risk-score"
            type="number"
            value={score}
            onChange={(event) => onScoreChange(event.target.value)}
            className="h-10 border-0 px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
          />
          <span className="pb-2 text-[11px] text-muted-foreground">pontos</span>
        </div>
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={onSimulate}><FlaskConical />Simular</Button>
      </div>

      <div className="min-h-[100px] rounded-xl border border-border bg-muted p-5" aria-live="polite">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Resultado simulado</p>
        {simulation && level ? (
          <div className="mt-3 flex items-center gap-3">
            <RiskLevelBadge level={level} />
            <div>
              <p className="text-sm font-semibold text-foreground">{jsonString(row?.label) || 'Classificação encontrada'}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{jsonString(row?.descricao) || 'Intervalo validado com sucesso.'}</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Aguardando uma simulação válida.
          </div>
        )}
      </div>
    </section>
  );
}

function MunicipalityPanel({
  items,
  selected,
  canCreate,
  onSelect,
  onCreate,
  onNameChange,
}: {
  items: RiskConfig[];
  selected: string;
  canCreate: boolean;
  onSelect: (item: RiskConfig) => void;
  onCreate: () => void;
  onNameChange: (value: string) => void;
}) {
  const isNew = !items.some((item) => item.municipality === selected);
  return (
    <Card className="rounded-lg p-6 md:col-span-1">
      <h2 className="text-base font-bold">Escopo municipal</h2>
      <p className="mt-1 text-xs text-muted-foreground">Selecione a configuração</p>
      {isNew && (
        <div className="mt-5">
          <Label htmlFor="risk-municipality">Novo município</Label>
          <Input
            id="risk-municipality"
            value={selected}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Informe o município"
            className="mt-2"
            autoFocus
          />
        </div>
      )}
      <div className="mt-5 space-y-2">
        {items.map((item) => {
          const published = item.versions.find((version) => version.status === 'published');
          const draft = item.versions.find((version) => version.status === 'draft');
          return (
            <button
              key={item.municipality}
              className={cn(
                'flex min-h-[68px] w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected === item.municipality && 'border-primary bg-success-soft',
              )}
              onClick={() => onSelect(item)}
              aria-pressed={selected === item.municipality}
            >
              <span className={cn('h-3 w-3 shrink-0 rounded-full bg-border', selected === item.municipality && 'bg-primary')} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.municipality}</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {draft ? `Rascunho · v${draft.version}` : published ? `Publicada · v${published.version}` : `${item.versions.length} versão(ões)`}
                </span>
              </span>
            </button>
          );
        })}
        {!items.length && <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">Nenhuma regra cadastrada.</p>}
      </div>
      {canCreate && (
        <Button variant="outline" className="mt-5 w-full" onClick={onCreate}>
          <Plus />
          Adicionar município
        </Button>
      )}
    </Card>
  );
}

function TierPanel({
  municipality,
  selected,
  tiers,
  config,
  advancedOpen,
  onAdvancedOpenChange,
  onConfigChange,
}: {
  municipality: string;
  selected: RiskConfig | null;
  tiers: RiskTier[];
  config: string;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  onConfigChange: (value: string) => void;
}) {
  const currentVersion = selected?.versions[0];
  return (
    <Card className="min-w-0 rounded-lg p-6 md:col-span-1">
      <h2 className="text-base font-bold">Faixas de classificação</h2>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {municipality || 'Novo município'}{currentVersion ? ` · ${currentVersion.status === 'draft' ? 'rascunho' : 'versão'} v${currentVersion.version}` : ''}
      </p>

      <div className="mt-5 space-y-3">
        {tiers.map((tier) => (
          <div key={tier.level} className="flex min-h-[72px] items-center gap-3 rounded-lg border bg-secondary/30 p-3">
            <RiskLevelBadge level={tier.level} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{formatRange(tier.min, tier.max)}</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{tier.label}</p>
            </div>
            <button className="text-[11px] font-bold text-primary hover:underline" onClick={() => onAdvancedOpenChange(true)}>Editar</button>
          </div>
        ))}
        {!tiers.length && (
          <p className="rounded-lg border border-destructive/25 bg-destructive-soft p-3 text-xs text-destructive">
            O JSON atual ainda não forma faixas R1–R4 válidas.
          </p>
        )}
      </div>

      <details
        open={advancedOpen}
        onToggle={(event) => onAdvancedOpenChange(event.currentTarget.open)}
        className="mt-5 rounded-lg border border-border bg-muted"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-2"><Braces className="h-4 w-4" />Configuração avançada (JSON)</span>
          <span aria-hidden="true">›</span>
        </summary>
        <div className="border-t border-border p-3">
          <Label htmlFor="risk-config" className="sr-only">Configuração dos intervalos em JSON</Label>
          <Textarea
            id="risk-config"
            value={config}
            onChange={(event) => onConfigChange(event.target.value)}
            rows={16}
            spellCheck={false}
            className="border-border bg-card font-mono text-[11px] text-foreground"
          />
        </div>
      </details>
    </Card>
  );
}

function VersionPanel({
  municipality,
  selected,
  simulationReady,
  canPrepare,
  canPublish,
  targetVersion,
  onSaveDraft,
  onPublish,
  onSelectVersion,
  onRollback,
}: {
  municipality: string;
  selected: RiskConfig | null;
  simulationReady: boolean;
  canPrepare: boolean;
  canPublish: boolean;
  targetVersion: number | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onSelectVersion: (version: RiskVersion) => void;
  onRollback: () => void;
}) {
  const latest = selected?.versions[0];
  return (
    <aside className="flex min-h-[544px] flex-col rounded-lg border border-border bg-card p-6 md:col-span-2 xl:col-span-1" aria-labelledby="risk-version-title">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Versão atual</p>
      <h2 id="risk-version-title" className="mt-3 text-lg font-bold">
        {municipality || 'Novo município'}{latest ? ` · v${latest.version}` : ''}
      </h2>
      <div className="mt-3">{latest ? <StatusBadge value={latest.status} /> : <StatusBadge value="draft" />}</div>

      <div className={cn(
        'mt-5 flex gap-3 rounded-lg border p-3 text-xs',
        simulationReady ? 'border-success/25 bg-success-soft text-foreground' : 'border-border bg-muted text-muted-foreground',
      )}>
        {simulationReady ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" />}
        {simulationReady ? 'Simulação válida. A configuração pode ser versionada.' : 'Execute uma simulação válida para liberar as ações.'}
      </div>

      <div className="my-6 h-px bg-border" />
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Histórico
      </p>
      <div className="mt-3 space-y-1">
        {selected?.versions.slice(0, 5).map((version) => (
          <button
            key={version.version}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-2 py-3 text-left text-xs hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              targetVersion === version.version && 'bg-secondary',
            )}
            onClick={() => onSelectVersion(version)}
          >
            <span className="font-bold text-foreground">v{version.version}</span>
            <span className="text-muted-foreground">{version.status === 'published' ? 'Publicada' : version.status === 'retired' ? 'Substituída' : 'Rascunho'}</span>
            <span className="text-[10px] text-muted-foreground">{formatDate(version.createdAt)}</span>
          </button>
        ))}
        {!selected?.versions.length && <p className="py-4 text-xs text-muted-foreground">Nenhuma versão registrada.</p>}
      </div>

      <div className="mt-auto space-y-2 pt-6">
        {canPrepare && <Button variant="secondary" className="w-full" disabled={!simulationReady || !municipality.trim()} onClick={onSaveDraft}>Salvar rascunho</Button>}
        {canPublish && <Button className="w-full" disabled={!simulationReady || !municipality.trim()} onClick={onPublish}>Publicar configuração</Button>}
        {canPublish && targetVersion && (
          <Button variant="outline" className="w-full" disabled={!simulationReady} onClick={onRollback}>
            <RotateCcw />
            Restaurar v{targetVersion}
          </Button>
        )}
      </div>
    </aside>
  );
}

function RiskLevelBadge({ level }: { level: RiskTier['level'] }) {
  const classes = {
    R1: 'bg-risk-r1/15 text-risk-r1',
    R2: 'bg-risk-r2/15 text-warning',
    R3: 'bg-risk-r3/15 text-risk-r3',
    R4: 'bg-risk-r4/15 text-risk-r4',
  };
  return <span className={cn('grid h-9 w-12 shrink-0 place-items-center rounded-full text-xs font-extrabold', classes[level])}>{level}</span>;
}

function currentConfiguration(item: RiskConfig): Json {
  const draft = item.versions.find((version) => version.status === 'draft');
  if (draft) return draft.configuration;
  if (Array.isArray(item.published) && item.published.length) return item.published;
  return item.versions[0]?.configuration || defaultConfig;
}

function parseTiers(value: Json): RiskTier[] {
  return jsonArray(value).map((item) => {
    const row = jsonObject(item);
    const level = normalizeLevel(jsonString(row?.nivel));
    const min = jsonNumber(row?.minPontos);
    const max = jsonNumber(row?.maxPontos);
    if (!level || min === null || max === null) return null;
    return {
      level,
      label: jsonString(row?.label) || level,
      description: jsonString(row?.descricao) || '',
      min,
      max,
    };
  }).filter((tier): tier is RiskTier => Boolean(tier));
}

function normalizeLevel(value: string | null): RiskTier['level'] | null {
  const normalized = value?.toUpperCase();
  return normalized === 'R1' || normalized === 'R2' || normalized === 'R3' || normalized === 'R4'
    ? normalized
    : null;
}

function formatRange(min: number, max: number) {
  return max >= 9999 ? `${min}+` : `${min} – ${max}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}
