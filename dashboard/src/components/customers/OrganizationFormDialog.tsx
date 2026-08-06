import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { useOrganizationMutation } from '@/hooks/useOrganizationMutation';
import type { CustomerDetailRecord, CustomerOnboarding } from '@/types/domain';

interface Props {
  open: boolean;
  customer?: CustomerDetailRecord;
  onboarding?: CustomerOnboarding | null;
  onClose: () => void;
  onSaved: (customerId: string) => void;
}

interface Draft {
  displayName: string;
  slug: string;
  legalName: string;
  municipalityName: string;
  stateCode: string;
  status: string;
  contactName: string;
  contactEmail: string;
  contractReference: string;
  sessionPolicy: string;
  sessionTimeoutMinutes: string;
  offlineToleranceMinutes: string;
  pilotStartedAt: string;
  coordinatorTrainedAt: string;
  reviewDueAt: string;
  reviewCompletedAt: string;
}

const emptyDraft: Draft = {
  displayName: '', slug: '', legalName: '', municipalityName: '', stateCode: '', status: 'onboarding',
  contactName: '', contactEmail: '', contractReference: '', sessionPolicy: 'block',
  sessionTimeoutMinutes: '480', offlineToleranceMinutes: '1440', pilotStartedAt: '',
  coordinatorTrainedAt: '', reviewDueAt: '', reviewCompletedAt: '',
};

export function OrganizationFormDialog({ open, customer, onboarding, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mutation = useOrganizationMutation();
  const editing = Boolean(customer);

  useEffect(() => {
    if (!open) return;
    setDraft(customer ? {
      displayName: customer.display_name,
      slug: slugify(customer.display_name),
      legalName: customer.legal_name || '', municipalityName: customer.municipality_name || '',
      stateCode: customer.state_code || '', status: customer.status, contactName: customer.contact_name || '',
      contactEmail: customer.contact_email || '', contractReference: customer.contract_reference || '',
      sessionPolicy: customer.session_policy || 'block', sessionTimeoutMinutes: String(customer.session_timeout_minutes ?? 480),
      offlineToleranceMinutes: String(customer.offline_tolerance_minutes ?? 1440),
      pilotStartedAt: dateInput(onboarding?.pilot_started_at), coordinatorTrainedAt: dateInput(onboarding?.coordinator_trained_at),
      reviewDueAt: dateInput(onboarding?.review_due_at), reviewCompletedAt: dateInput(onboarding?.review_completed_at),
    } : emptyDraft);
    setError(null);
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, [customer, onboarding, open]);

  const payload = useMemo(() => ({
    ...(!editing ? { slug: draft.slug } : {}),
    display_name: draft.displayName.trim(), legal_name: draft.legalName.trim(),
    municipality_name: draft.municipalityName.trim(), state_code: draft.stateCode.trim().toUpperCase(),
    status: draft.status, contact_name: draft.contactName.trim(), contact_email: draft.contactEmail.trim(),
    contract_reference: draft.contractReference.trim(), session_policy: draft.sessionPolicy,
    session_timeout_minutes: Number(draft.sessionTimeoutMinutes),
    offline_tolerance_minutes: Number(draft.offlineToleranceMinutes),
    onboarding: {
      pilot_started_at: isoOrEmpty(draft.pilotStartedAt), coordinator_trained_at: isoOrEmpty(draft.coordinatorTrainedAt),
      review_due_at: isoOrEmpty(draft.reviewDueAt), review_completed_at: isoOrEmpty(draft.reviewCompletedAt),
    },
  }), [draft, editing]);

  if (!open) return null;
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value, ...(!editing && key === 'displayName' ? { slug: slugify(String(value)) } : {}) }));
  }
  function validate() {
    if (draft.displayName.trim().length < 3) return 'Informe um nome com pelo menos 3 caracteres.';
    if (!editing && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) return 'O identificador deve conter letras minúsculas, números e hífens.';
    if (draft.stateCode && !/^[A-Z]{2}$/.test(draft.stateCode.toUpperCase())) return 'A UF deve ter duas letras.';
    if (draft.contactEmail && !/^\S+@\S+\.\S+$/.test(draft.contactEmail)) return 'Informe um e-mail de contato válido.';
    if (Number(draft.sessionTimeoutMinutes) < 5 || Number(draft.sessionTimeoutMinutes) > 43200) return 'Timeout de sessão fora do intervalo permitido.';
    return null;
  }
  function requestSave() {
    const validation = validate();
    if (validation) { setError(validation); return; }
    setError(null);
    setConfirming(true);
  }

  return <><div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="organization-form-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border bg-card p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 id="organization-form-title" className="text-xl font-bold">{editing ? 'Editar organização' : 'Novo cliente municipal'}</h2><p className="mt-1 text-sm text-muted-foreground">Cadastro, política de sessão e marcos de implantação.</p></div><button ref={closeRef} onClick={onClose} aria-label="Fechar formulário" className="rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Nome de exibição" value={draft.displayName} onChange={(value) => update('displayName', value)} required />{!editing && <Field label="Identificador" value={draft.slug} onChange={(value) => update('slug', slugify(value))} required />}<Field label="Razão social" value={draft.legalName} onChange={(value) => update('legalName', value)} /><Field label="Município" value={draft.municipalityName} onChange={(value) => update('municipalityName', value)} /><Field label="UF" value={draft.stateCode} onChange={(value) => update('stateCode', value.toUpperCase().slice(0, 2))} /><SelectField label="Status" value={draft.status} values={['onboarding', 'pilot', 'active', 'suspended', 'archived']} onChange={(value) => update('status', value)} /><Field label="Contato" value={draft.contactName} onChange={(value) => update('contactName', value)} /><Field label="E-mail" type="email" value={draft.contactEmail} onChange={(value) => update('contactEmail', value)} /><Field label="Referência contratual" value={draft.contractReference} onChange={(value) => update('contractReference', value)} /><SelectField label="Política de sessão" value={draft.sessionPolicy} values={['block', 'replace']} onChange={(value) => update('sessionPolicy', value)} /><Field label="Timeout da sessão (min)" type="number" value={draft.sessionTimeoutMinutes} onChange={(value) => update('sessionTimeoutMinutes', value)} /><Field label="Tolerância offline (min)" type="number" value={draft.offlineToleranceMinutes} onChange={(value) => update('offlineToleranceMinutes', value)} /><Field label="Início do piloto" type="datetime-local" value={draft.pilotStartedAt} onChange={(value) => update('pilotStartedAt', value)} /><Field label="Coordenação treinada" type="datetime-local" value={draft.coordinatorTrainedAt} onChange={(value) => update('coordinatorTrainedAt', value)} /><Field label="Revisão prevista" type="datetime-local" value={draft.reviewDueAt} onChange={(value) => update('reviewDueAt', value)} /><Field label="Revisão concluída" type="datetime-local" value={draft.reviewCompletedAt} onChange={(value) => update('reviewCompletedAt', value)} /></div>{error && <p className="mt-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button><button onClick={requestSave} className="flex items-center gap-2 bg-primary rounded-lg px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover">{mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Salvar alterações' : 'Criar cliente'}</button></div></div></div><HighRiskDialog open={confirming} title={editing ? 'Confirmar alteração do cliente' : 'Confirmar criação do cliente'} description="A operação exige MFA, justificativa e será registrada na auditoria." confirmLabel={editing ? 'Salvar cliente' : 'Criar cliente'} onClose={() => setConfirming(false)} onConfirm={async (reason) => { const result = await mutation.mutateAsync({ organizationId: customer?.subject_id ?? null, action: editing ? 'update' : 'create', payload, reason }); if (!result.ok || !result.data) throw new Error(result.error || 'Não foi possível salvar o cliente.'); setConfirming(false); onSaved(result.data.customer_id); }} /></>;
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="text-sm"><span className="font-semibold text-foreground">{label}{required ? ' *' : ''}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-1 h-10 w-full rounded-lg border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>; }
function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <label className="text-sm"><span className="font-semibold text-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3">{values.map((item) => <option key={item}>{item}</option>)}</select></label>; }
function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function dateInput(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ''; }
function isoOrEmpty(value: string) { return value ? new Date(value).toISOString() : ''; }
