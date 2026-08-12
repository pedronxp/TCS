import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { useIndividualCustomerMutation } from '@/hooks/useIndividualCustomerMutation';
import type { CustomerDetailRecord } from '@/types/domain';

interface Props {
  open: boolean;
  customer: CustomerDetailRecord;
  canViewSensitive: boolean;
  onClose: () => void;
  onSaved: (customerId: string) => void;
}

interface Draft {
  displayName: string;
  contactName: string;
  contactEmail: string;
  status: string;
}

export function IndividualEditDialog({ open, customer, canViewSensitive, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>({
    displayName: '',
    contactName: '',
    contactEmail: '',
    status: 'onboarding',
  });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useIndividualCustomerMutation();

  useEffect(() => {
    if (!open) return;
    setDraft({
      displayName: customer.display_name,
      contactName: customer.contact_name || '',
      contactEmail: customer.contact_email || '',
      status: customer.status,
    });
    setError(null);
    setConfirming(false);
  }, [customer, open]);

  const payload = useMemo(() => ({
    display_name: draft.displayName.trim(),
    contact_name: draft.contactName.trim(),
    ...(canViewSensitive ? { contact_email: draft.contactEmail.trim() } : {}),
    status: draft.status,
  }), [draft, canViewSensitive]);

  if (!open) return null;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    if (draft.displayName.trim().length < 2) return 'Informe um nome com pelo menos 2 caracteres.';
    if (canViewSensitive && draft.contactEmail && !/^\S+@\S+\.\S+$/.test(draft.contactEmail.trim())) {
      return 'Informe um e-mail válido.';
    }
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
        <DialogContent className="max-w-xl gap-0 p-0 motion-reduce:animate-none">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card px-6 py-4">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle>Editar cliente individual</DialogTitle>
              <DialogDescription className="mt-1">
                Atualize os dados cadastrais do cliente. Alterações são registradas na auditoria.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Form */}
          <div className="space-y-8 p-6">
            {/* Identificação */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identificação</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome de exibição"
                  value={draft.displayName}
                  onChange={(value) => update('displayName', value)}
                  required
                  placeholder="Pedro Paulo"
                />
                <SelectField
                  label="Status"
                  value={draft.status}
                  options={[
                    { value: 'onboarding', label: 'Em implantação' },
                    { value: 'active', label: 'Ativo' },
                    { value: 'suspended', label: 'Suspenso' },
                    { value: 'archived', label: 'Arquivado' },
                  ]}
                  onChange={(value) => update('status', value)}
                />
              </div>
            </section>

            {/* Contato */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contato</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome do contato"
                  value={draft.contactName}
                  onChange={(value) => update('contactName', value)}
                  placeholder="Pedro Paulo"
                />
                {canViewSensitive ? (
                  <Field
                    label="E-mail do contato"
                    type="email"
                    value={draft.contactEmail}
                    onChange={(value) => update('contactEmail', value)}
                    placeholder="pedro@exemplo.com"
                  />
                ) : (
                  <div className="space-y-2">
                    <Label>E-mail do contato</Label>
                    <p className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      Dados protegidos por permissão
                    </p>
                  </div>
                )}
              </div>
            </section>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={requestSave} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title="Confirmar alteração"
        description="A operação exige MFA, justificativa e será registrada na auditoria."
        confirmLabel="Salvar cliente"
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          const result = await mutation.mutateAsync({
            customerId: customer.customer_id,
            payload,
            reason,
          });
          if (!result.ok || !result.data) throw new Error(result.error || 'Não foi possível salvar o cliente.');
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
      />
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
