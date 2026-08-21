import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  Check,
  Edit3,
  Gauge,
  Loader2,
  LockKeyhole,
  Rocket,
  Save,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { useAuth } from '@/contexts/AuthContext';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { usePlanMutation } from '@/hooks/usePlanMutation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { PageHeader } from '@/components/domain/PageHeader';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/supabase';

type PlanStatus = 'draft' | 'active' | 'retired';
type ResourceCode = 'users' | 'inspections' | 'invitations' | 'storage_bytes' | 'sessions';
type Priority = 'low' | 'normal' | 'high' | 'critical';

interface CommercialConfig {
  [key: string]: import('@/types/supabase').Json | undefined;
  monthly_price_cents: number | null;
  annual_price_cents: number | null;
  currency: 'BRL';
  trial_days: number;
  grace_days: number;
  overage_policy: 'block' | 'manual_review' | 'allow_and_bill' | 'custom';
  support_tier: 'standard' | 'priority' | 'specialized';
  support_channels: string[];
  support_hours: string;
}

interface FeatureRow {
  code: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  audience: 'individual' | 'organization' | 'compatibility';
  status: PlanStatus;
  current_version: number;
  plan_features: { feature_code: string; enabled: boolean }[];
  plan_limits: { resource_code: ResourceCode; hard_limit: number | null; warning_percent: number }[];
  plan_versions: { version: number; configuration: Json; published_at: string | null }[];
  support_sla_policies: { priority: Priority; response_minutes: number; resolution_minutes: number | null; escalation_minutes: number | null }[];
}

interface LimitDraft {
  enabled: boolean;
  unlimited: boolean;
  hardLimit: string;
  warningPercent: string;
}

interface SlaDraft {
  enabled: boolean;
  responseHours: string;
  resolutionHours: string;
  escalationHours: string;
}

interface PlanDraft {
  name: string;
  description: string;
  status: PlanStatus;
  monthlyPrice: string;
  annualPrice: string;
  trialDays: string;
  graceDays: string;
  overagePolicy: CommercialConfig['overage_policy'];
  supportTier: CommercialConfig['support_tier'];
  supportChannels: string;
  supportHours: string;
  features: Record<string, boolean>;
  limits: Record<ResourceCode, LimitDraft>;
  sla: Record<Priority, SlaDraft>;
}

const RESOURCE_META: { code: ResourceCode; label: string; hint: string }[] = [
  { code: 'users', label: 'Usuários / Agentes', hint: 'Quantidade ativa no plano' },
  { code: 'inspections', label: 'Vistorias por período', hint: 'Vistorias sincronizadas no ciclo' },
  { code: 'invitations', label: 'Convites por período', hint: 'Convites municipais emitidos' },
  { code: 'storage_bytes', label: 'Armazenamento (GB)', hint: 'Fotos e laudos enviados' },
  { code: 'sessions', label: 'Sessões simultâneas', hint: 'Acessos ativos por usuário' },
];

const PRIORITY_META: { code: Priority; label: string }[] = [
  { code: 'low', label: 'Baixa' },
  { code: 'normal', label: 'Normal' },
  { code: 'high', label: 'Alta' },
  { code: 'critical', label: 'Crítica' },
];

const STATUS_LABEL: Record<PlanStatus, string> = { draft: 'Rascunho', active: 'Ativo', retired: 'Retirado' };
const OVERAGE_LABEL: Record<CommercialConfig['overage_policy'], string> = {
  block: 'Bloquear novo consumo',
  manual_review: 'Análise manual',
  allow_and_bill: 'Permitir e cobrar excedente',
  custom: 'Definido em contrato',
};
const SUPPORT_LABEL: Record<CommercialConfig['support_tier'], string> = {
  standard: 'Padrão',
  priority: 'Prioritário',
  specialized: 'Especializado',
};

const DEFAULT_COMMERCIAL: CommercialConfig = {
  monthly_price_cents: null,
  annual_price_cents: null,
  currency: 'BRL',
  trial_days: 0,
  grace_days: 0,
  overage_policy: 'block',
  support_tier: 'standard',
  support_channels: ['E-mail'],
  support_hours: 'Dias úteis, horário comercial',
};

export function PlansPage({ demo = false }: { demo?: boolean }) {
  const { can } = useAuth();
  const canWrite = can('commercial.write');
  const [plans, setPlans] = useState<PlanRow[]>(demo ? createDemoPlans() : []);
  const [features, setFeatures] = useState<FeatureRow[]>(demo ? DEMO_FEATURES : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<{ plan: PlanRow; draft: PlanDraft } | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<'organization' | 'individual' | 'all'>('organization');
  const planMutation = usePlanMutation();

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    setError(null);
    const [plansResult, featuresResult] = await Promise.all([
      supabase
        .from('plans')
        .select('id,code,name,description,audience,status,current_version,plan_features(feature_code,enabled),plan_limits(resource_code,hard_limit,warning_percent),plan_versions(version,configuration,published_at),support_sla_policies(priority,response_minutes,resolution_minutes,escalation_minutes)')
        .order('name'),
      supabase.from('features').select('code,name,category,description,active').order('category').order('name'),
    ]);
    const firstError = plansResult.error || featuresResult.error;
    if (firstError) setError(firstError.message);
    else {
      setPlans((plansResult.data || []).map((plan): PlanRow => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        audience: parseAudience(plan.audience),
        status: parsePlanStatus(plan.status),
        current_version: plan.current_version,
        plan_features: plan.plan_features,
        plan_limits: plan.plan_limits.map((limit) => ({ ...limit, resource_code: parseResourceCode(limit.resource_code) })),
        plan_versions: plan.plan_versions,
        support_sla_policies: plan.support_sla_policies.map((policy) => ({ ...policy, priority: parsePriority(policy.priority) })),
      })));
      setFeatures(featuresResult.data || []);
    }
    setLoading(false);
  }, [demo]);

  useEffect(() => {
    load();
  }, [load]);

  const commercialPlans = useMemo(() => plans.filter(plan => plan.audience !== 'compatibility'), [plans]);
  const compatibility = plans.find(plan => plan.audience === 'compatibility');
  const visiblePlans = useMemo(
    () => commercialPlans.filter((plan) => audienceFilter === 'all' || plan.audience === audienceFilter),
    [audienceFilter, commercialPlans],
  );
  const publishedVersions = useMemo(
    () => commercialPlans
      .flatMap((plan) => plan.plan_versions
        .filter((version) => version.published_at)
        .map((version) => ({ plan, version })))
      .sort((a, b) => (b.version.published_at || '').localeCompare(a.version.published_at || ''))
      .slice(0, 5),
    [commercialPlans],
  );
  const draftCount = commercialPlans.filter((plan) => plan.status === 'draft').length;

  const savePlan = async (plan: PlanRow, draft: PlanDraft, reason: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      validateDraft(draft);
      const commercial = commercialPayload(draft);
      const limits = limitsPayload(draft);
      const sla = slaPayload(draft);

      if (demo) {
        setPlans(current => current.map(item => item.id === plan.id
          ? applyDemoSave(item, draft, commercial, limits, sla)
          : item));
        setNotice('Proposta comercial atualizada na demonstração local.');
      } else {
        const saved = await planMutation.mutateAsync({ planId: plan.id, plan: { name: draft.name.trim(), description: draft.description.trim() || null, status: draft.status }, commercial, features: draft.features, limits, sla, reason });
        if (!saved.ok) throw new Error(saved.error);
        await load();
        setNotice('Proposta comercial salva com nova versão criada com sucesso.');
      }
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a proposta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack space-y-6 max-w-7xl mx-auto" aria-labelledby="plans-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Gestão Comercial"
          title="Catálogo de Planos"
          description="Versões, limites de recursos, tabelas de SLA e condições comerciais da operação."
        />
        <div className="inline-flex rounded-xl border border-border/80 bg-card p-1 shadow-xs self-start sm:self-center" role="group" aria-label="Filtrar planos por público">
          {([
            ['organization', 'Municipais'],
            ['individual', 'Individuais'],
            ['all', 'Todos os planos'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={audienceFilter === value}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all',
                audienceFilter === value
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
              )}
              onClick={() => setAudienceFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {demo && <DemoBadge />}

      <AsyncBoundary
        loading={loading}
        error={error && !editing ? new Error(error) : undefined}
        empty={!loading && !error && commercialPlans.length === 0}
        onRetry={() => void load()}
        loadingLabel="Carregando catálogo comercial…"
        emptyTitle="Nenhum plano comercial"
        emptyDescription="Os planos cadastrados aparecerão aqui."
      >
        {/* Banner Informativo */}
        <Card className="rounded-2xl border-border/70 bg-gradient-to-r from-primary/10 via-card to-card p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Versionamento Comercial Auditável</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Toda atualização cria uma versão rastreável e mantém a integridade dos contratos ativos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-lg bg-card/80 px-3 py-1 font-semibold">
                {draftCount} {draftCount === 1 ? 'rascunho em elaboração' : 'rascunhos em elaboração'}
              </Badge>
            </div>
          </div>
        </Card>

        {notice && (
          <div role="status" className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-xs font-medium text-success-foreground">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {/* Grid de Planos e Histórico */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visiblePlans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                features={features}
                featured={audienceFilter === 'organization' && index === Math.min(1, visiblePlans.length - 1)}
                onEdit={canWrite ? () => { setError(null); setEditing(plan); } : undefined}
              />
            ))}
          </div>

          {/* Painel Lateral: Histórico de Versões */}
          <Card className="rounded-2xl border-border/80 bg-card/90 backdrop-blur-sm shadow-xs h-fit">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Histórico</p>
                  <h2 className="text-base font-bold text-foreground mt-0.5">Versões Publicadas</h2>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {publishedVersions.map(({ plan, version }) => (
                  <div key={`${plan.id}-${version.version}`} className="rounded-xl border border-border/60 bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-foreground">{plan.name}</p>
                      <Badge variant="success" className="px-1.5 py-0.2 text-[9px] font-bold">
                        v{version.version}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Publicado em {formatDate(version.published_at)}
                    </p>
                  </div>
                ))}
                {publishedVersions.length === 0 && (
                  <p className="rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">Ainda não há edições publicadas.</p>
                )}
              </div>

              <div className="mt-5 border-t border-border/60 pt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total de Planos</span>
                <span className="font-bold text-foreground">{commercialPlans.length} cadastrados</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quadro Comparativo */}
        <Card className="rounded-2xl border-border/80 bg-card/80 backdrop-blur-sm shadow-xs p-6">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Visão Rápida</p>
              <h2 className="text-lg font-bold text-foreground mt-0.5">Resumo de Recursos e Preços</h2>
            </div>
            <Badge variant="secondary" className="rounded-lg">{visiblePlans.length} exibidos</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {visiblePlans.slice(0, 3).map((plan) => {
              const commercial = getCommercial(plan);
              return (
                <div key={plan.id} className="rounded-xl border border-border/60 bg-muted/30 p-4 hover:border-primary/40 transition-all">
                  <span className="text-xs font-bold text-foreground">{plan.name}</span>
                  <p className="mt-2 text-xl font-extrabold text-primary">{formatPrice(commercial.monthly_price_cents)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatLimit(plan, 'users', 'usuários')} · Suporte {SUPPORT_LABEL[commercial.support_tier]}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {compatibility && (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground">
            <LockKeyhole className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <b className="text-foreground">{compatibility.name}</b>: plano técnico reservado para migração de clientes legados.
            </div>
          </div>
        )}
      </AsyncBoundary>

      {editing && (
        <PlanEditor
          plan={editing}
          featureCatalog={features}
          saving={saving}
          error={error}
          onClose={() => { if (!saving) { setEditing(null); setError(null); } }}
          onSave={draft => setPendingSave({ plan: editing, draft })}
        />
      )}

      {pendingSave && (
        <HighRiskDialog
          open
          title="Confirmar publicação de versão"
          description="Preços, limites de consumo e políticas de SLA serão vinculados a esta versão na auditoria."
          confirmLabel="Salvar Versão Comercial"
          onClose={() => setPendingSave(null)}
          onConfirm={async reason => {
            await savePlan(pendingSave.plan, pendingSave.draft, reason);
            setPendingSave(null);
          }}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, features, featured, onEdit }: { plan: PlanRow; features: FeatureRow[]; featured?: boolean; onEdit?: () => void }) {
  const commercial = getCommercial(plan);
  const enabledFeatures = plan.plan_features.filter(item => item.enabled);
  const normalSla = plan.support_sla_policies.find(item => item.priority === 'normal');

  return (
    <Card className={cn(
      'flex flex-col rounded-2xl transition-all duration-200 overflow-hidden shadow-xs border',
      featured ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-border/80 bg-card text-card-foreground hover:border-primary/40'
    )}>
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={featured ? 'secondary' : plan.status === 'active' ? 'success' : 'warning'} className="rounded-lg text-[10px]">
                {STATUS_LABEL[plan.status]}
              </Badge>
              <span className={cn('text-xs font-mono', featured ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                v{plan.current_version}
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
          </div>
          {featured && (
            <span className="rounded-full bg-primary-foreground px-2.5 py-0.5 text-[9px] font-extrabold uppercase text-primary tracking-wider">
              Popular
            </span>
          )}
        </div>

        <p className={cn('mt-2 text-xs leading-relaxed line-clamp-2', featured ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          {plan.description || 'Sem descrição comercial.'}
        </p>

        <div className="mt-5 pt-4 border-t border-border/40">
          <div className="flex items-baseline gap-1">
            <span className={cn('text-3xl font-extrabold tracking-tight', featured ? 'text-primary-foreground' : 'text-foreground')}>
              {formatPrice(commercial.monthly_price_cents)}
            </span>
            <span className={cn('text-xs font-medium', featured ? 'text-primary-foreground/70' : 'text-muted-foreground')}>/ mês</span>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 flex-1">
          {[
            formatLimit(plan, 'users', 'usuários'),
            formatLimit(plan, 'inspections', 'vistorias'),
            `Suporte ${SUPPORT_LABEL[commercial.support_tier]} (${normalSla ? formatHours(normalSla.response_minutes) : 'SLA padronizado'})`,
            enabledFeatures[0] ? (features.find((item) => item.code === enabledFeatures[0].feature_code)?.name || enabledFeatures[0].feature_code) : 'Recursos sob medida',
          ].map((line, idx) => (
            <div key={idx} className={cn('flex items-center gap-2.5 text-xs font-medium', featured ? 'text-primary-foreground/90' : 'text-foreground/90')}>
              <Check className={cn('h-4 w-4 shrink-0', featured ? 'text-primary-foreground' : 'text-primary')} />
              <span className="truncate">{line}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border/40">
          {onEdit ? (
            <Button
              variant={featured ? 'secondary' : 'outline'}
              className={cn('w-full rounded-xl gap-2 font-semibold', featured && 'bg-primary-foreground text-primary hover:bg-primary-foreground/90')}
              onClick={onEdit}
            >
              <Edit3 className="h-4 w-4" /> Editar Proposta
            </Button>
          ) : (
            <p className={cn('text-center text-xs', featured ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
              {OVERAGE_LABEL[commercial.overage_policy]}
            </p>
          )}

          {plan.status === 'retired' && (
            <p className={cn('rounded-lg border px-3 py-2 text-xs leading-5', featured ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80' : 'border-border bg-muted/30 text-muted-foreground')} role="status">
              Plano arquivado: assinaturas ativas continuam válidas, mas novas ativações não são permitidas. Reative ou publique uma nova versão para retomar a venda.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanEditor({ plan, featureCatalog, saving, error, onClose, onSave }: {
  plan: PlanRow;
  featureCatalog: FeatureRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: PlanDraft) => void;
}) {
  const baseline = useMemo(() => createDraft(plan, featureCatalog), [plan, featureCatalog]);
  const [draft, setDraft] = useState<PlanDraft>(() => createDraft(plan, featureCatalog));
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const issues = collectValidation(draft);
  const willPublish = draft.status === 'active';

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl p-0 shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Editar Plano: {plan.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">Versão atual: v{plan.current_version}</p>
            </div>
          </div>
          {isDirty && (
            <Badge variant="warning" className="rounded-lg text-xs">
              Alterações pendentes
            </Badge>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Erro ao salvar:</strong> {error}
              </div>
            </div>
          )}

          {issues.length > 0 && !error && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-3 text-xs font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <span>{issues.length} {issues.length === 1 ? 'campo precisa de correção.' : 'campos precisam de correção.'}</span>
            </div>
          )}

          {/* Dados Principais */}
          <EditorSection icon={<Edit3 />} title="Informações Gerais" description="Identificação e status do plano no catálogo.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome Comercial">
                <input value={draft.name} onChange={event => set('name', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Status da Versão">
                <select value={draft.status} onChange={event => set('status', event.target.value as PlanStatus)} className={inputClass}>
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo (Publicado)</option>
                  <option value="retired">Retirado</option>
                </select>
              </Field>
            </div>
            <Field label="Descrição Comercial">
              <textarea rows={2} value={draft.description} onChange={event => set('description', event.target.value)} className={inputClass} />
            </Field>
          </EditorSection>

          {/* Condições Comerciais */}
          <EditorSection icon={<BadgeDollarSign />} title="Preço e Validade" description="Valores monetários e período de testes.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Mensal (R$)">
                <input type="number" min="0" step="0.01" placeholder="Sob consulta" value={draft.monthlyPrice} onChange={event => set('monthlyPrice', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Anual (R$)">
                <input type="number" min="0" step="0.01" placeholder="Sob consulta" value={draft.annualPrice} onChange={event => set('annualPrice', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Trial (Dias)">
                <input type="number" min="0" max="365" value={draft.trialDays} onChange={event => set('trialDays', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Carência (Dias)">
                <input type="number" min="0" max="365" value={draft.graceDays} onChange={event => set('graceDays', event.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Política de Excedente">
                <select value={draft.overagePolicy} onChange={event => set('overagePolicy', event.target.value as CommercialConfig['overage_policy'])} className={inputClass}>
                  {Object.entries(OVERAGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Nível de Suporte">
                <select value={draft.supportTier} onChange={event => set('supportTier', event.target.value as CommercialConfig['support_tier'])} className={inputClass}>
                  {Object.entries(SUPPORT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
            </div>
          </EditorSection>

          {/* Recursos Ativos */}
          <EditorSection icon={<Boxes />} title="Funcionalidades Habilitadas" description="Selecione os módulos disponíveis neste plano.">
            <div className="grid gap-3 sm:grid-cols-2">
              {featureCatalog.filter(feature => feature.active).map(feature => {
                const enabled = !!draft.features[feature.code];
                return (
                  <label key={feature.code} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${enabled ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-card hover:bg-secondary/40'}`}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={event => set('features', { ...draft.features, [feature.code]: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-primary rounded"
                    />
                    <div>
                      <span className="block text-xs font-bold text-foreground">{feature.name}</span>
                      <span className="text-[11px] text-muted-foreground">{feature.description || feature.code}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </EditorSection>

          {/* Limites de Consumo */}
          <EditorSection icon={<Gauge />} title="Limites de Recursos" description="Defina as quotas operacionais da conta.">
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 text-left">Recurso</th>
                    <th className="p-3 text-center">Ativo</th>
                    <th className="p-3 text-center">Ilimitado</th>
                    <th className="p-3 text-left">Limite Rígido</th>
                    <th className="p-3 text-left">Alerta (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {RESOURCE_META.map(resource => {
                    const limit = draft.limits[resource.code];
                    const update = (patch: Partial<LimitDraft>) => set('limits', { ...draft.limits, [resource.code]: { ...limit, ...patch } });
                    return (
                      <tr key={resource.code} className="hover:bg-muted/30">
                        <td className="p-3">
                          <strong className="block font-semibold text-foreground">{resource.label}</strong>
                          <span className="text-[10px] text-muted-foreground">{resource.hint}</span>
                        </td>
                        <td className="p-3 text-center">
                          <input type="checkbox" checked={limit.enabled} onChange={event => update({ enabled: event.target.checked })} className="h-4 w-4 accent-primary" />
                        </td>
                        <td className="p-3 text-center">
                          <input type="checkbox" disabled={!limit.enabled} checked={limit.unlimited} onChange={event => update({ unlimited: event.target.checked })} className="h-4 w-4 accent-primary disabled:opacity-30" />
                        </td>
                        <td className="p-3">
                          <input type="number" min="0" disabled={!limit.enabled || limit.unlimited} value={limit.hardLimit} onChange={event => update({ hardLimit: event.target.value })} className={cn(inputClass, "w-28 py-1.5")} />
                        </td>
                        <td className="p-3">
                          <input type="number" min="1" max="100" disabled={!limit.enabled} value={limit.warningPercent} onChange={event => update({ warningPercent: event.target.value })} className={cn(inputClass, "w-20 py-1.5")} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </EditorSection>
        </div>

        <footer className="flex items-center justify-between border-t border-border/60 px-6 py-4 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {willPublish ? `A nova versão v${plan.current_version + 1} será publicada imediatamente.` : 'Salva como rascunho sem impactar assinaturas.'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" className="rounded-xl gap-2" onClick={() => onSave(draft)} disabled={saving || issues.length > 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando…' : 'Confirmar e Salvar'}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function EditorSection({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
      <div className="flex items-center gap-3 border-b border-border/50 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        {label}
        {hint && <span className="font-normal text-muted-foreground">• {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function DemoBadge() {
  return (
    <Badge variant="warning" className="w-fit rounded-lg px-3 py-1 font-semibold">
      Ambiente de Demonstração
    </Badge>
  );
}

const inputClass = 'w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function getCommercial(plan: PlanRow): CommercialConfig {
  const version = plan.plan_versions.find(item => item.version === plan.current_version) || [...plan.plan_versions].sort((a, b) => b.version - a.version)[0];
  const configuration = jsonObject(version?.configuration);
  const value = jsonObject(configuration?.commercial);
  if (!value) return DEFAULT_COMMERCIAL;
  const overage = jsonString(value.overage_policy);
  const support = jsonString(value.support_tier);
  return {
    monthly_price_cents: jsonNumber(value.monthly_price_cents),
    annual_price_cents: jsonNumber(value.annual_price_cents),
    currency: 'BRL',
    trial_days: jsonNumber(value.trial_days) ?? DEFAULT_COMMERCIAL.trial_days,
    grace_days: jsonNumber(value.grace_days) ?? DEFAULT_COMMERCIAL.grace_days,
    overage_policy: overage === 'manual_review' || overage === 'allow_and_bill' || overage === 'custom' ? overage : 'block',
    support_tier: support === 'priority' || support === 'specialized' ? support : 'standard',
    support_channels: jsonArray(value.support_channels).filter((item): item is string => typeof item === 'string'),
    support_hours: jsonString(value.support_hours) || DEFAULT_COMMERCIAL.support_hours,
  };
}

function parsePlanStatus(value: string): PlanStatus {
  if (value === 'active' || value === 'retired') return value;
  return 'draft';
}

function parseAudience(value: string): PlanRow['audience'] {
  if (value === 'individual' || value === 'organization') return value;
  return 'compatibility';
}

function parseResourceCode(value: string): ResourceCode {
  if (value === 'inspections' || value === 'invitations' || value === 'storage_bytes' || value === 'sessions') return value;
  return 'users';
}

function parsePriority(value: string): Priority {
  if (value === 'low' || value === 'high' || value === 'critical') return value;
  return 'normal';
}

function createDraft(plan: PlanRow, featureCatalog: FeatureRow[]): PlanDraft {
  const commercial = getCommercial(plan);
  const features = Object.fromEntries(featureCatalog.map(feature => [feature.code, plan.plan_features.find(item => item.feature_code === feature.code)?.enabled || false]));
  const limits = Object.fromEntries(RESOURCE_META.map(resource => {
    const current = plan.plan_limits.find(item => item.resource_code === resource.code);
    return [resource.code, { enabled: !!current, unlimited: !!current && current.hard_limit === null, hardLimit: current?.hard_limit?.toString() || '', warningPercent: String(current?.warning_percent || 80) }];
  })) as Record<ResourceCode, LimitDraft>;
  const sla = Object.fromEntries(PRIORITY_META.map(priority => {
    const current = plan.support_sla_policies.find(item => item.priority === priority.code);
    return [priority.code, { enabled: !!current, responseHours: minutesToInput(current?.response_minutes), resolutionHours: minutesToInput(current?.resolution_minutes), escalationHours: minutesToInput(current?.escalation_minutes) }];
  })) as Record<Priority, SlaDraft>;
  return {
    name: plan.name,
    description: plan.description || '',
    status: plan.status,
    monthlyPrice: centsToInput(commercial.monthly_price_cents),
    annualPrice: centsToInput(commercial.annual_price_cents),
    trialDays: String(commercial.trial_days),
    graceDays: String(commercial.grace_days),
    overagePolicy: commercial.overage_policy,
    supportTier: commercial.support_tier,
    supportChannels: commercial.support_channels.join(', '),
    supportHours: commercial.support_hours,
    features,
    limits,
    sla,
  };
}

function collectValidation(draft: PlanDraft): string[] {
  const out: string[] = [];
  if (!draft.name.trim()) out.push('Informe o nome do plano.');
  for (const [label, value] of [['Teste grátis', draft.trialDays], ['Carência', draft.graceDays]] as const) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 365) out.push(`${label} deve estar entre 0 e 365 dias.`);
  }
  for (const resource of RESOURCE_META) {
    const limit = draft.limits[resource.code];
    if (!limit.enabled) continue;
    if (!limit.unlimited && (!Number.isInteger(Number(limit.hardLimit)) || Number(limit.hardLimit) < 0)) out.push(`Informe um limite válido para ${resource.label}.`);
    if (!Number.isInteger(Number(limit.warningPercent)) || Number(limit.warningPercent) < 1 || Number(limit.warningPercent) > 100) out.push(`O alerta de ${resource.label} deve estar entre 1% e 100%.`);
  }
  for (const priority of PRIORITY_META) {
    const sla = draft.sla[priority.code];
    if (sla.enabled && (!sla.responseHours || Number(sla.responseHours) <= 0)) out.push(`Informe a primeira resposta do SLA ${priority.label}.`);
  }
  return out;
}

function validateDraft(draft: PlanDraft) {
  if (!draft.name.trim()) throw new Error('Informe o nome do plano.');
  for (const [label, value] of [['Teste grátis', draft.trialDays], ['Carência', draft.graceDays]] as const) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 365) throw new Error(`${label} deve estar entre 0 e 365 dias.`);
  }
  for (const resource of RESOURCE_META) {
    const limit = draft.limits[resource.code];
    if (!limit.enabled) continue;
    if (!limit.unlimited && (!Number.isInteger(Number(limit.hardLimit)) || Number(limit.hardLimit) < 0)) throw new Error(`Informe um limite válido para ${resource.label}.`);
    if (!Number.isInteger(Number(limit.warningPercent)) || Number(limit.warningPercent) < 1 || Number(limit.warningPercent) > 100) throw new Error(`O alerta de ${resource.label} deve estar entre 1% e 100%.`);
  }
  for (const priority of PRIORITY_META) {
    const sla = draft.sla[priority.code];
    if (sla.enabled && (!sla.responseHours || Number(sla.responseHours) <= 0)) throw new Error(`Informe a primeira resposta do SLA ${priority.label}.`);
  }
}

function commercialPayload(draft: PlanDraft): CommercialConfig {
  return {
    monthly_price_cents: moneyToCents(draft.monthlyPrice),
    annual_price_cents: moneyToCents(draft.annualPrice),
    currency: 'BRL',
    trial_days: Number(draft.trialDays),
    grace_days: Number(draft.graceDays),
    overage_policy: draft.overagePolicy,
    support_tier: draft.supportTier,
    support_channels: draft.supportChannels.split(',').map(value => value.trim()).filter(Boolean),
    support_hours: draft.supportHours.trim(),
  };
}

function limitsPayload(draft: PlanDraft) {
  return Object.fromEntries(RESOURCE_META.flatMap(resource => {
    const value = draft.limits[resource.code];
    return value.enabled ? [[resource.code, { hard_limit: value.unlimited ? null : Number(value.hardLimit), warning_percent: Number(value.warningPercent) }]] : [];
  }));
}

function slaPayload(draft: PlanDraft) {
  return Object.fromEntries(PRIORITY_META.flatMap(priority => {
    const value = draft.sla[priority.code];
    return value.enabled ? [[priority.code, { response_minutes: hoursToMinutes(value.responseHours), resolution_minutes: hoursToMinutes(value.resolutionHours), escalation_minutes: hoursToMinutes(value.escalationHours) }]] : [];
  }));
}

function applyDemoSave(plan: PlanRow, draft: PlanDraft, commercial: CommercialConfig, limits: ReturnType<typeof limitsPayload>, sla: ReturnType<typeof slaPayload>): PlanRow {
  const version = plan.current_version + 1;
  return {
    ...plan,
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    status: draft.status,
    current_version: version,
    plan_features: Object.entries(draft.features).map(([feature_code, enabled]) => ({ feature_code, enabled })),
    plan_limits: Object.entries(limits).map(([resource_code, value]) => ({ resource_code: resource_code as ResourceCode, ...(value as { hard_limit: number | null; warning_percent: number }) })),
    plan_versions: [...plan.plan_versions, { version, configuration: { commercial }, published_at: draft.status === 'active' ? new Date().toISOString() : null }],
    support_sla_policies: Object.entries(sla).map(([priority, value]) => ({ priority: priority as Priority, ...(value as { response_minutes: number; resolution_minutes: number | null; escalation_minutes: number | null }) })),
  };
}

function moneyToCents(value: string) { return value.trim() === '' ? null : Math.round(Number(value) * 100); }
function centsToInput(value: number | null | undefined) { return value == null ? '' : (value / 100).toFixed(2); }
function hoursToMinutes(value: string) { return value.trim() === '' ? null : Math.round(Number(value) * 60); }
function minutesToInput(value: number | null | undefined) { return value == null ? '' : String(value / 60); }
function formatPrice(value: number | null) { return value == null ? 'Sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100); }
function formatHours(minutes: number) { return minutes % 1440 === 0 ? `${minutes / 1440} dia(s)` : `${minutes / 60}h`; }
function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'não publicada';
}
function formatLimit(plan: PlanRow, resource: ResourceCode, label: string) {
  const limit = plan.plan_limits.find((item) => item.resource_code === resource);
  if (!limit || limit.hard_limit == null) return `${label} sem limite`;
  return `${new Intl.NumberFormat('pt-BR').format(limit.hard_limit)} ${label}`;
}

const DEMO_FEATURES: FeatureRow[] = [
  { code: 'inspection_standard', name: 'Vistoria padrão', category: 'inspection_model', description: 'Fluxos de vistoria disponíveis no app', active: true },
  { code: 'inspection_arv', name: 'Vistoria de Árvores (ARV)', category: 'inspection_model', description: 'Formulário técnico para vistoria de árvores', active: true },
  { code: 'training_mode', name: 'Modo treinamento', category: 'module', description: 'Turmas e vistorias de treinamento', active: true },
  { code: 'reports_basic', name: 'Relatórios básicos', category: 'module', description: 'Laudos e exportações essenciais', active: true },
  { code: 'reports_advanced', name: 'Relatórios avançados', category: 'module', description: 'Relatórios e análises ampliadas', active: true },
  { code: 'reports_institutional', name: 'Relatórios institucionais', category: 'module', description: 'Relatórios personalizados para organizações', active: true },
  { code: 'indicators_essential', name: 'Indicadores essenciais', category: 'module', description: 'Indicadores e mapas essenciais', active: true },
  { code: 'indicators_complete', name: 'Indicadores completos', category: 'module', description: 'Indicadores e mapas completos', active: true },
  { code: 'indicators_custom', name: 'Indicadores personalizados', category: 'module', description: 'Indicadores configurados para a organização', active: true },
  { code: 'municipal_coordination', name: 'Coordenação municipal', category: 'module', description: 'Agentes, convites e sessões da organização', active: true },
];

const DEMO_COMMERCIAL: Record<string, CommercialConfig> = {
  individual_basic: { monthly_price_cents: 7990, annual_price_cents: 79900, currency: 'BRL', trial_days: 14, grace_days: 7, overage_policy: 'block', support_tier: 'standard', support_channels: ['E-mail'], support_hours: 'Dias úteis, 9h às 18h' },
  individual_professional: { monthly_price_cents: 14990, annual_price_cents: 149900, currency: 'BRL', trial_days: 14, grace_days: 7, overage_policy: 'block', support_tier: 'priority', support_channels: ['E-mail', 'Portal'], support_hours: 'Dias úteis, 8h às 18h' },
  municipal_basic: { monthly_price_cents: 149000, annual_price_cents: 1490000, currency: 'BRL', trial_days: 30, grace_days: 15, overage_policy: 'manual_review', support_tier: 'standard', support_channels: ['E-mail', 'Portal'], support_hours: 'Dias úteis, 8h às 18h' },
  municipal_professional: { monthly_price_cents: 399000, annual_price_cents: 3990000, currency: 'BRL', trial_days: 30, grace_days: 15, overage_policy: 'manual_review', support_tier: 'priority', support_channels: ['E-mail', 'Portal', 'WhatsApp'], support_hours: 'Dias úteis, 8h às 18h' },
  municipal_complete: { monthly_price_cents: 699000, annual_price_cents: 6990000, currency: 'BRL', trial_days: 30, grace_days: 30, overage_policy: 'custom', support_tier: 'specialized', support_channels: ['E-mail', 'Portal', 'WhatsApp', 'Telefone'], support_hours: 'Atendimento estendido' },
};

const DEMO_DESCRIPTIONS: Record<string, string> = {
  individual_basic: 'Para o profissional autônomo que está iniciando a operação digital.',
  individual_professional: 'Para profissionais com maior volume de vistorias e relatórios avançados.',
  municipal_basic: 'Para prefeituras com equipes de até 10 agentes e operação municipal essencial.',
  municipal_professional: 'Para prefeituras com equipes de até 30 agentes, indicadores completos e suporte prioritário.',
  municipal_complete: 'Plano municipal completo a partir do valor-base, com ARV, treinamento e condições ajustáveis por contrato.',
};

const DEMO_SLA: Record<string, PlanRow['support_sla_policies']> = {
  individual_basic: createSla([[4320, 10080, 2880], [2880, 7200, 1440], [1440, 4320, 720], [720, 2880, 360]]),
  individual_professional: createSla([[2880, 7200, 1440], [1440, 4320, 720], [480, 2880, 240], [240, 1440, 120]]),
  municipal_basic: createSla([[2880, 7200, 1440], [1440, 4320, 720], [480, 2880, 240], [240, 1440, 120]]),
  municipal_professional: createSla([[1440, 4320, 720], [480, 2880, 240], [240, 1440, 120], [120, 720, 60]]),
  municipal_complete: createSla([[480, 2880, 240], [240, 1440, 120], [120, 720, 60], [60, 480, 30]]),
};

function createSla(values: [number, number, number][]): PlanRow['support_sla_policies'] {
  const priorities: Priority[] = ['low', 'normal', 'high', 'critical'];
  return values.map(([response_minutes, resolution_minutes, escalation_minutes], index) => ({ priority: priorities[index], response_minutes, resolution_minutes, escalation_minutes }));
}

function createDemoPlans(): PlanRow[] {
  const data = [
    ['individual-basic', 'individual_basic', 'Individual Básico', 'individual', 30, 1, 10, 1073741824],
    ['individual-pro', 'individual_professional', 'Individual Profissional', 'individual', 150, 1, 50, 5368709120],
    ['municipal-basic', 'municipal_basic', 'Municipal Básico', 'organization', 300, 10, 50, 21474836480],
    ['municipal-pro', 'municipal_professional', 'Municipal Profissional', 'organization', 1000, 30, 200, 107374182400],
    ['municipal-complete', 'municipal_complete', 'Municipal Completo', 'organization', 5000, 100, 1000, 536870912000],
  ] as const;
  const enabled: Record<string, string[]> = {
    individual_basic: ['inspection_standard', 'reports_basic'],
    individual_professional: ['inspection_standard', 'reports_advanced'],
    municipal_basic: ['inspection_standard', 'reports_basic', 'indicators_essential', 'municipal_coordination'],
    municipal_professional: ['inspection_standard', 'reports_advanced', 'indicators_complete', 'municipal_coordination'],
    municipal_complete: DEMO_FEATURES.map(feature => feature.code),
  };
  const plans = data.map(([id, code, name, audience, inspections, users, invitations, storageBytes]): PlanRow => {
    const commercial = DEMO_COMMERCIAL[code];
    return { id, code, name, description: DEMO_DESCRIPTIONS[code], audience, status: 'draft', current_version: 2, plan_features: DEMO_FEATURES.map(feature => ({ feature_code: feature.code, enabled: enabled[code].includes(feature.code) })), plan_limits: [
      { resource_code: 'users', hard_limit: users, warning_percent: 80 },
      { resource_code: 'inspections', hard_limit: inspections, warning_percent: 80 },
      { resource_code: 'invitations', hard_limit: invitations, warning_percent: 80 },
      { resource_code: 'storage_bytes', hard_limit: storageBytes, warning_percent: 80 },
      { resource_code: 'sessions', hard_limit: 1, warning_percent: 100 },
    ], plan_versions: [{ version: 2, configuration: { commercial }, published_at: null }], support_sla_policies: DEMO_SLA[code] };
  });
  plans.push({ id: 'compatibility', code: 'compatibility', name: 'Compatibilidade', description: 'Fluxo legado durante a migração.', audience: 'compatibility', status: 'active', current_version: 1, plan_features: [], plan_limits: [], plan_versions: [], support_sla_policies: [] });
  return plans;
}
