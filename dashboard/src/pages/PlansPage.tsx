import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Boxes,
  Check,
  Edit3,
  Gauge,
  Headphones,
  Loader2,
  LockKeyhole,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OwnerPage } from '@/components/OwnerPage';

type PlanStatus = 'draft' | 'active' | 'retired';
type ResourceCode = 'users' | 'inspections' | 'invitations' | 'storage_bytes' | 'sessions';
type Priority = 'low' | 'normal' | 'high' | 'critical';

interface CommercialConfig {
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
  plan_versions: { version: number; configuration: { commercial?: Partial<CommercialConfig> }; published_at: string | null }[];
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
  { code: 'users', label: 'Usuários / agentes', hint: 'Quantidade ativa no plano' },
  { code: 'inspections', label: 'Vistorias por período', hint: 'Vistorias sincronizadas no ciclo' },
  { code: 'invitations', label: 'Convites por período', hint: 'Convites municipais emitidos' },
  { code: 'storage_bytes', label: 'Armazenamento (bytes)', hint: 'Fotos e laudos enviados' },
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
  manual_review: 'Enviar para análise manual',
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
  const [plans, setPlans] = useState<PlanRow[]>(demo ? createDemoPlans() : []);
  const [features, setFeatures] = useState<FeatureRow[]>(demo ? DEMO_FEATURES : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
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
      setPlans((plansResult.data || []) as unknown as PlanRow[]);
      setFeatures((featuresResult.data || []) as FeatureRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [demo]);

  const commercialPlans = useMemo(() => plans.filter(plan => plan.audience !== 'compatibility'), [plans]);
  const compatibility = plans.find(plan => plan.audience === 'compatibility');

  const savePlan = async (plan: PlanRow, draft: PlanDraft) => {
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
        setNotice('Proposta atualizada na demonstração local. Nenhum dado real foi alterado.');
      } else {
        const { error: saveError } = await supabase.rpc('update_plan_commercial_configuration', {
          p_plan_id: plan.id,
          p_plan: { name: draft.name.trim(), description: draft.description.trim() || null, status: draft.status },
          p_commercial: commercial,
          p_features: draft.features,
          p_limits: limits,
          p_sla: sla,
        });
        if (saveError) throw saveError;
        await load();
        setNotice('Proposta salva e uma nova versão comercial foi criada.');
      }
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a proposta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OwnerPage
      title="Planos e recursos"
      description="Edite propostas comerciais, limites, recursos e metas de suporte com histórico por versão."
      loading={loading}
      error={error && !editing ? error : null}
      actions={demo ? <DemoBadge /> : undefined}
    >
      <div className="space-y-4">
        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Check className="h-4 w-4" /> {notice}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {commercialPlans.map(plan => (
            <PlanCard key={plan.id} plan={plan} features={features} onEdit={() => { setError(null); setEditing(plan); }} />
          ))}
        </div>

        {compatibility && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-100/70 p-4 text-sm text-slate-600">
            <LockKeyhole className="h-5 w-5" />
            <div><b>{compatibility.name}</b> é um plano técnico de transição e não pode ser comercializado ou editado aqui.</div>
          </div>
        )}
      </div>

      {editing && (
        <PlanEditor
          plan={editing}
          featureCatalog={features}
          saving={saving}
          error={error}
          onClose={() => { if (!saving) { setEditing(null); setError(null); } }}
          onSave={draft => savePlan(editing, draft)}
        />
      )}
    </OwnerPage>
  );
}

function PlanCard({ plan, features, onEdit }: { plan: PlanRow; features: FeatureRow[]; onEdit: () => void }) {
  const commercial = getCommercial(plan);
  const enabledFeatures = plan.plan_features.filter(item => item.enabled);
  const normalSla = plan.support_sla_policies.find(item => item.priority === 'normal');
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(plan.status)}`}>{STATUS_LABEL[plan.status]}</span>
            <span className="text-xs text-slate-400">v{plan.current_version}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{plan.description || 'Sem descrição comercial.'}</p>
        </div>
        <button onClick={onEdit} className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
          <Edit3 className="h-4 w-4" /> Editar
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Summary icon={<BadgeDollarSign />} label="Mensalidade" value={formatPrice(commercial.monthly_price_cents)} />
        <Summary icon={<Gauge />} label="Teste / carência" value={`${commercial.trial_days}d / ${commercial.grace_days}d`} />
        <Summary icon={<Headphones />} label="Suporte" value={SUPPORT_LABEL[commercial.support_tier]} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {enabledFeatures.map(item => {
          const feature = features.find(candidate => candidate.code === item.feature_code);
          return <span key={item.feature_code} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">{feature?.name || item.feature_code}</span>;
        })}
        {enabledFeatures.length === 0 && <span className="text-xs text-slate-400">Nenhum recurso habilitado</span>}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <b className="text-slate-700">SLA normal:</b> {normalSla ? `${formatHours(normalSla.response_minutes)} para primeira resposta` : 'definido em contrato'}
        <span className="mx-2 text-slate-300">•</span>{OVERAGE_LABEL[commercial.overage_policy]}
      </div>
    </article>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2 text-slate-400 [&>svg]:h-4 [&>svg]:w-4"><span>{icon}</span><span className="text-[10px] font-bold uppercase tracking-wide">{label}</span></div><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>;
}

function PlanEditor({ plan, featureCatalog, saving, error, onClose, onSave }: {
  plan: PlanRow;
  featureCatalog: FeatureRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: PlanDraft) => void;
}) {
  const [draft, setDraft] = useState<PlanDraft>(() => createDraft(plan, featureCatalog));
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft(current => ({ ...current, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-8">
      <div role="dialog" aria-modal="true" aria-labelledby="plan-editor-title" className="w-full max-w-6xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Editor comercial • versão atual {plan.current_version}</p><h2 id="plan-editor-title" className="text-xl font-bold text-slate-900">{plan.name}</h2></div>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar editor"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-6 p-5 sm:p-7">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <EditorSection icon={<Edit3 />} title="Identificação da proposta" description="Nome, descrição e disponibilidade comercial.">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <Field label="Nome do plano"><input value={draft.name} onChange={event => set('name', event.target.value)} className={inputClass} /></Field>
              <Field label="Status"><select value={draft.status} onChange={event => set('status', event.target.value as PlanStatus)} className={inputClass}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="retired">Retirado</option></select></Field>
            </div>
            <Field label="Descrição"><textarea rows={3} value={draft.description} onChange={event => set('description', event.target.value)} className={inputClass} /></Field>
          </EditorSection>

          <EditorSection icon={<BadgeDollarSign />} title="Condições comerciais" description="Preços em reais; deixe em branco para valor personalizado por contrato.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Preço mensal (R$)"><input type="number" min="0" step="0.01" placeholder="Personalizado" value={draft.monthlyPrice} onChange={event => set('monthlyPrice', event.target.value)} className={inputClass} /></Field>
              <Field label="Preço anual (R$)"><input type="number" min="0" step="0.01" placeholder="Personalizado" value={draft.annualPrice} onChange={event => set('annualPrice', event.target.value)} className={inputClass} /></Field>
              <Field label="Teste grátis (dias)"><input type="number" min="0" max="365" value={draft.trialDays} onChange={event => set('trialDays', event.target.value)} className={inputClass} /></Field>
              <Field label="Carência (dias)"><input type="number" min="0" max="365" value={draft.graceDays} onChange={event => set('graceDays', event.target.value)} className={inputClass} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ao atingir o limite"><select value={draft.overagePolicy} onChange={event => set('overagePolicy', event.target.value as CommercialConfig['overage_policy'])} className={inputClass}>{Object.entries(OVERAGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Modalidade de suporte"><select value={draft.supportTier} onChange={event => set('supportTier', event.target.value as CommercialConfig['support_tier'])} className={inputClass}>{Object.entries(SUPPORT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Canais de suporte" hint="Separe por vírgula"><input value={draft.supportChannels} onChange={event => set('supportChannels', event.target.value)} placeholder="E-mail, WhatsApp, telefone" className={inputClass} /></Field>
              <Field label="Horário de atendimento"><input value={draft.supportHours} onChange={event => set('supportHours', event.target.value)} placeholder="Segunda a sexta, 8h às 18h" className={inputClass} /></Field>
            </div>
          </EditorSection>

          <EditorSection icon={<Boxes />} title="Catálogo de recursos" description="ARV significa Vistoria de Árvores.">
            <div className="grid gap-3 md:grid-cols-2">
              {featureCatalog.filter(feature => feature.active).map(feature => {
                const enabled = !!draft.features[feature.code];
                return <label key={feature.code} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${enabled ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}><input type="checkbox" checked={enabled} onChange={event => set('features', { ...draft.features, [feature.code]: event.target.checked })} className="mt-1 h-4 w-4 accent-blue-600" /><span><b className="text-sm text-slate-900">{feature.name}</b><span className="mt-1 block text-xs text-slate-500">{feature.description || feature.code}</span></span></label>;
              })}
            </div>
          </EditorSection>

          <EditorSection icon={<Gauge />} title="Limites e alertas" description="Ative apenas os recursos controlados; sem limite mantém a medição sem bloquear.">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Recurso</th><th className="p-3">Controlar</th><th className="p-3">Sem limite</th><th className="p-3">Limite</th><th className="p-3">Alerta</th></tr></thead><tbody>{RESOURCE_META.map(resource => {
                const limit = draft.limits[resource.code];
                const update = (patch: Partial<LimitDraft>) => set('limits', { ...draft.limits, [resource.code]: { ...limit, ...patch } });
                return <tr key={resource.code} className="border-t border-slate-100"><td className="p-3"><b className="text-slate-800">{resource.label}</b><span className="block text-xs text-slate-400">{resource.hint}</span></td><td className="p-3"><input type="checkbox" checked={limit.enabled} onChange={event => update({ enabled: event.target.checked })} className="h-4 w-4 accent-blue-600" /></td><td className="p-3"><input type="checkbox" disabled={!limit.enabled} checked={limit.unlimited} onChange={event => update({ unlimited: event.target.checked })} className="h-4 w-4 accent-blue-600 disabled:opacity-30" /></td><td className="p-3"><input type="number" min="0" disabled={!limit.enabled || limit.unlimited} value={limit.hardLimit} onChange={event => update({ hardLimit: event.target.value })} className={`${inputClass} w-32 disabled:bg-slate-100 disabled:text-slate-400`} /></td><td className="p-3"><div className="flex items-center gap-1"><input type="number" min="1" max="100" disabled={!limit.enabled} value={limit.warningPercent} onChange={event => update({ warningPercent: event.target.value })} className={`${inputClass} w-24 disabled:bg-slate-100`} /><span className="text-slate-400">%</span></div></td></tr>;
              })}</tbody></table>
            </div>
          </EditorSection>

          <EditorSection icon={<Headphones />} title="Metas de SLA" description="Horas corridas para primeira resposta, resolução e escalonamento; deixe os campos opcionais vazios.">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Prioridade</th><th className="p-3">Aplicar</th><th className="p-3">1ª resposta (h)</th><th className="p-3">Resolução (h)</th><th className="p-3">Escalonar após (h)</th></tr></thead><tbody>{PRIORITY_META.map(priority => {
                const sla = draft.sla[priority.code];
                const update = (patch: Partial<SlaDraft>) => set('sla', { ...draft.sla, [priority.code]: { ...sla, ...patch } });
                return <tr key={priority.code} className="border-t border-slate-100"><td className="p-3 font-semibold text-slate-800">{priority.label}</td><td className="p-3"><input type="checkbox" checked={sla.enabled} onChange={event => update({ enabled: event.target.checked })} className="h-4 w-4 accent-blue-600" /></td><td className="p-3"><input type="number" min="0.25" step="0.25" disabled={!sla.enabled} value={sla.responseHours} onChange={event => update({ responseHours: event.target.value })} className={`${inputClass} w-32 disabled:bg-slate-100`} /></td><td className="p-3"><input type="number" min="0.25" step="0.25" disabled={!sla.enabled} value={sla.resolutionHours} onChange={event => update({ resolutionHours: event.target.value })} placeholder="Opcional" className={`${inputClass} w-32 disabled:bg-slate-100`} /></td><td className="p-3"><input type="number" min="0.25" step="0.25" disabled={!sla.enabled} value={sla.escalationHours} onChange={event => update({ escalationHours: event.target.value })} placeholder="Opcional" className={`${inputClass} w-32 disabled:bg-slate-100`} /></td></tr>;
              })}</tbody></table>
            </div>
          </EditorSection>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
          <p className="text-xs text-slate-500">Ao salvar, o sistema cria a versão {plan.current_version + 1} e registra a alteração na auditoria.</p>
          <div className="flex gap-2"><button onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button><button onClick={() => onSave(draft)} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando...' : 'Salvar nova versão'}</button></div>
        </footer>
      </div>
    </div>
  );
}

function EditorSection({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-5 flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 [&>svg]:h-5 [&>svg]:w-5">{icon}</div><div><h3 className="font-bold text-slate-900">{title}</h3><p className="text-xs text-slate-500">{description}</p></div></div><div className="space-y-4">{children}</div></section>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">{label}{hint && <span className="font-normal text-slate-400">• {hint}</span>}</span>{children}</label>;
}

function DemoBadge() {
  return <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Demonstração local</span>;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function getCommercial(plan: PlanRow): CommercialConfig {
  const version = plan.plan_versions.find(item => item.version === plan.current_version) || [...plan.plan_versions].sort((a, b) => b.version - a.version)[0];
  const value = version?.configuration?.commercial || {};
  return { ...DEFAULT_COMMERCIAL, ...value, support_channels: value.support_channels || DEFAULT_COMMERCIAL.support_channels };
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

function statusClass(status: PlanStatus) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800';
  if (status === 'retired') return 'bg-slate-200 text-slate-600';
  return 'bg-amber-100 text-amber-800';
}

function moneyToCents(value: string) { return value.trim() === '' ? null : Math.round(Number(value) * 100); }
function centsToInput(value: number | null | undefined) { return value == null ? '' : (value / 100).toFixed(2); }
function hoursToMinutes(value: string) { return value.trim() === '' ? null : Math.round(Number(value) * 60); }
function minutesToInput(value: number | null | undefined) { return value == null ? '' : String(value / 60); }
function formatPrice(value: number | null) { return value == null ? 'Personalizado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100); }
function formatHours(minutes: number) { return minutes % 1440 === 0 ? `${minutes / 1440} dia(s)` : `${minutes / 60}h`; }

const DEMO_FEATURES: FeatureRow[] = [
  { code: 'inspection_standard', name: 'Vistoria padrão', category: 'inspection_model', description: 'Fluxos de vistoria já disponíveis no aplicativo', active: true },
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

function createDemoPlans(): PlanRow[] {
  const data = [
    ['individual-basic', 'individual_basic', 'Individual Básico', 'individual', 30, 1, 10, 'standard'],
    ['individual-pro', 'individual_professional', 'Individual Profissional', 'individual', 150, 1, 50, 'priority'],
    ['municipal-basic', 'municipal_basic', 'Municipal Básico', 'organization', 300, 10, 50, 'standard'],
    ['municipal-pro', 'municipal_professional', 'Municipal Profissional', 'organization', 1000, 30, 200, 'priority'],
    ['municipal-complete', 'municipal_complete', 'Municipal Completo', 'organization', null, null, null, 'specialized'],
  ] as const;
  const enabled: Record<string, string[]> = {
    individual_basic: ['inspection_standard', 'reports_basic'],
    individual_professional: ['inspection_standard', 'reports_advanced'],
    municipal_basic: ['inspection_standard', 'reports_basic', 'indicators_essential', 'municipal_coordination'],
    municipal_professional: ['inspection_standard', 'reports_advanced', 'indicators_complete', 'municipal_coordination'],
    municipal_complete: DEMO_FEATURES.map(feature => feature.code),
  };
  const plans = data.map(([id, code, name, audience, inspections, users, invitations, supportTier]): PlanRow => {
    const commercial = { ...DEFAULT_COMMERCIAL, support_tier: supportTier as CommercialConfig['support_tier'] };
    return { id, code, name, description: 'Proposta comercial editável pelo proprietário.', audience, status: 'draft', current_version: 1, plan_features: DEMO_FEATURES.map(feature => ({ feature_code: feature.code, enabled: enabled[code].includes(feature.code) })), plan_limits: [
      { resource_code: 'users', hard_limit: users, warning_percent: 80 },
      { resource_code: 'inspections', hard_limit: inspections, warning_percent: 80 },
      { resource_code: 'invitations', hard_limit: invitations, warning_percent: 80 },
      { resource_code: 'sessions', hard_limit: 1, warning_percent: 100 },
    ], plan_versions: [{ version: 1, configuration: { commercial }, published_at: null }], support_sla_policies: supportTier === 'specialized' ? [] : [{ priority: 'normal', response_minutes: supportTier === 'priority' ? 1440 : 2880, resolution_minutes: null, escalation_minutes: null }] };
  });
  plans.push({ id: 'compatibility', code: 'compatibility', name: 'Compatibilidade', description: 'Fluxo legado durante a migração.', audience: 'compatibility', status: 'active', current_version: 1, plan_features: [], plan_limits: [], plan_versions: [], support_sla_policies: [] });
  return plans;
}
