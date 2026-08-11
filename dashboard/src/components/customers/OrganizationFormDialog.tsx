import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
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

interface CoordinatorDraft {
  sendEmailInvite: boolean;
  coordinatorPassword: string;
  coordinatorPasswordConfirmation: string;
}

const emptyDraft: Draft = {
  displayName: '', slug: '', legalName: '', municipalityName: '', stateCode: '', status: 'onboarding',
  contactName: '', contactEmail: '', contractReference: '', sessionPolicy: 'block',
  sessionTimeoutMinutes: '480', offlineToleranceMinutes: '1440', pilotStartedAt: '',
  coordinatorTrainedAt: '', reviewDueAt: '', reviewCompletedAt: '',
};

const emptyCoordinator: CoordinatorDraft = {
  sendEmailInvite: true,
  coordinatorPassword: '',
  coordinatorPasswordConfirmation: '',
};

export function OrganizationFormDialog({ open, customer, onboarding, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [coordinator, setCoordinator] = useState<CoordinatorDraft>(emptyCoordinator);
  const [showPassword, setShowPassword] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setCoordinator(emptyCoordinator);
    setShowPassword(false);
    setError(null);
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
    ...(!editing && !coordinator.sendEmailInvite && coordinator.coordinatorPassword
      ? { coordinator_password: coordinator.coordinatorPassword }
      : {}),
  }), [draft, editing, coordinator.sendEmailInvite, coordinator.coordinatorPassword]);

  if (!open) return null;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value, ...(!editing && key === 'displayName' ? { slug: slugify(String(value)) } : {}) }));
  }

  function validate() {
    if (draft.displayName.trim().length < 3) return 'Informe um nome com pelo menos 3 caracteres.';
    if (!editing && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) return 'O identificador deve conter apenas letras minúsculas, números e hífens.';
    if (draft.stateCode && !/^[A-Z]{2}$/.test(draft.stateCode.toUpperCase())) return 'A UF deve ter exatamente duas letras.';
    if (draft.contactEmail && !/^\S+@\S+\.\S+$/.test(draft.contactEmail)) return 'Informe um e-mail válido.';
    if (!editing && !coordinator.sendEmailInvite) {
      if (coordinator.coordinatorPassword.length < 8) return 'A senha temporária deve ter pelo menos 8 caracteres.';
      if (coordinator.coordinatorPassword !== coordinator.coordinatorPasswordConfirmation) return 'As senhas não coincidem.';
    }
    if (!editing && !coordinator.sendEmailInvite) {
      if (coordinator.coordinatorPassword.length < 8) return 'A senha temporária deve ter pelo menos 8 caracteres.';
      if (coordinator.coordinatorPassword !== coordinator.coordinatorPasswordConfirmation) return 'As senhas não coincidem.';
    }
    if (Number(draft.sessionTimeoutMinutes) < 5 || Number(draft.sessionTimeoutMinutes) > 43200) return 'Timeout de sessão deve estar entre 5 e 43200 minutos.';
    if (Number(draft.offlineToleranceMinutes) < 0) return 'Tolerância offline não pode ser negativa.';
    return null;
  }

  function requestSave() {
    const validation = validate();
    if (validation) { setError(validation); return; }
    setError(null);
    setConfirming(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !mutation.isPending) onClose(); }}>
        <DialogContent className="max-w-4xl gap-0 p-0 motion-reduce:animate-none">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card px-6 py-4">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle>
                {editing ? 'Editar organização' : 'Nova organização'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {editing ? 'Atualize os dados cadastrais e marcos de implantação.' : 'Cadastre uma nova organização municipal com suas informações e políticas.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Form */}
          <div className="space-y-8 p-6">
            {/* Identificação */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identificação</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nome de exibição" value={draft.displayName} onChange={(value) => update('displayName', value)} required placeholder="Prefeitura de São Paulo" />
                {!editing && (
                  <Field label="Identificador único" value={draft.slug} onChange={(value) => update('slug', slugify(value))} required placeholder="prefeitura-sao-paulo" helperText="Letras minúsculas, números e hífens" />
                )}
                <Field label="Razão social" value={draft.legalName} onChange={(value) => update('legalName', value)} placeholder="Município de São Paulo" />
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <Field label="Município" value={draft.municipalityName} onChange={(value) => update('municipalityName', value)} placeholder="São Paulo" />
                  <Field label="UF" value={draft.stateCode} onChange={(value) => update('stateCode', value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
                </div>
              </div>
            </section>

            {/* Status e Contato */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status e Contato</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Status"
                  value={draft.status}
                  options={[
                    { value: 'onboarding', label: 'Onboarding' },
                    { value: 'pilot', label: 'Piloto' },
                    { value: 'active', label: 'Ativo' },
                    { value: 'suspended', label: 'Suspenso' },
                    { value: 'archived', label: 'Arquivado' },
                  ]}
                  onChange={(value) => update('status', value)}
                />
                <Field label="Referência contratual" value={draft.contractReference} onChange={(value) => update('contractReference', value)} placeholder="CONTRATO-2024-001" />
                <Field label="Contato principal" value={draft.contactName} onChange={(value) => update('contactName', value)} placeholder="João Silva" />
                <Field label="E-mail do contato" type="email" value={draft.contactEmail} onChange={(value) => update('contactEmail', value)} placeholder="joao.silva@prefeitura.sp.gov.br" />
              </div>
            </section>

            {/* Políticas de Sessão */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Políticas de Sessão</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Política de sessão"
                  value={draft.sessionPolicy}
                  options={[
                    { value: 'block', label: 'Bloquear nova sessão' },
                    { value: 'replace', label: 'Substituir sessão anterior' },
                  ]}
                  onChange={(value) => update('sessionPolicy', value)}
                />
                <Field label="Timeout (minutos)" type="number" value={draft.sessionTimeoutMinutes} onChange={(value) => update('sessionTimeoutMinutes', value)} placeholder="480" />
                <Field label="Tolerância offline (min)" type="number" value={draft.offlineToleranceMinutes} onChange={(value) => update('offlineToleranceMinutes', value)} placeholder="1440" />
              </div>
            </section>

            {/* Marcos de Implantação */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Marcos de Implantação</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Início do piloto" type="datetime-local" value={draft.pilotStartedAt} onChange={(value) => update('pilotStartedAt', value)} />
                <Field label="Coordenação treinada" type="datetime-local" value={draft.coordinatorTrainedAt} onChange={(value) => update('coordinatorTrainedAt', value)} />
                <Field label="Revisão prevista" type="datetime-local" value={draft.reviewDueAt} onChange={(value) => update('reviewDueAt', value)} />
                <Field label="Revisão concluída" type="datetime-local" value={draft.reviewCompletedAt} onChange={(value) => update('reviewCompletedAt', value)} />
              </div>
            </section>

            {/* Acesso do Coordenador */}
            {!editing && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Acesso do Coordenador</h3>
                <div className="mt-4 space-y-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={coordinator.sendEmailInvite}
                      onChange={(e) => setCoordinator((prev) => ({ ...prev, sendEmailInvite: e.target.checked }))}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm">Enviar convite por e-mail (o coordenador define a própria senha)</span>
                  </label>
                  {!coordinator.sendEmailInvite && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PasswordField
                        label="Senha temporária"
                        value={coordinator.coordinatorPassword}
                        show={showPassword}
                        onChange={(v) => setCoordinator((prev) => ({ ...prev, coordinatorPassword: v }))}
                        onToggle={() => setShowPassword((prev) => !prev)}
                      />
                      <PasswordField
                        label="Confirmar senha"
                        value={coordinator.coordinatorPasswordConfirmation}
                        show={showPassword}
                        onChange={(v) => setCoordinator((prev) => ({ ...prev, coordinatorPasswordConfirmation: v }))}
                        onToggle={() => setShowPassword((prev) => !prev)}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={requestSave} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              {editing ? 'Salvar alterações' : 'Criar organização'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title={editing ? 'Confirmar alteração' : 'Confirmar criação'}
        description="A operação exige MFA, justificativa e será registrada na auditoria."
        confirmLabel={editing ? 'Salvar organização' : 'Criar organização'}
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          const result = await mutation.mutateAsync({
            organizationId: customer?.subject_id ?? null,
            action: editing ? 'update' : 'create',
            payload,
            reason,
          });
          if (!result.ok || !result.data) throw new Error(result.error || 'Não foi possível salvar a organização.');
          setConfirming(false);
          onSaved(result.data.customer_id);
        }}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  helperText,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  maxLength?: number;
}) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PasswordField({
  label,
  value,
  show,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  show: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
    const id = `password-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

function isoOrEmpty(value: string) {
  return value ? new Date(value).toISOString() : '';
}
