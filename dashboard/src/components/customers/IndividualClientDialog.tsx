import { useEffect, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { type IndividualProvisioningMode, useIndividualClientProvisioning } from '@/hooks/useIndividualClientProvisioning';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (customerId: string) => void;
}

export function IndividualClientDialog({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<IndividualProvisioningMode>('email_invite');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useIndividualClientProvisioning();

  useEffect(() => {
    if (open) return;
    setPassword('');
    setConfirmation('');
    setConfirming(false);
    setError(null);
  }, [open]);

  function requestProvisioning() {
    const normalizedEmail = email.trim().toLowerCase();
    if (name.trim().length < 2) return setError('Informe o nome do cliente.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Informe um e-mail válido.');
    if (mode === 'initial_password') {
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return setError('A senha deve ter ao menos 8 caracteres, uma letra e um número.');
      }
      if (password !== confirmation) return setError('As senhas não coincidem.');
    }
    setError(null);
    setConfirming(true);
  }

  const close = () => {
    setPassword('');
    setConfirmation('');
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !mutation.isPending && !confirming) close(); }}>
        <DialogContent className="max-w-2xl motion-reduce:animate-none">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Novo cliente individual</DialogTitle>
            <DialogDescription>Crie a conta por convite de e-mail ou defina uma senha inicial.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
            <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Como liberar o acesso?</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ModeCard checked={mode === 'email_invite'} title="Enviar convite por e-mail" description="O Supabase envia um link temporário e de uso único para o cliente criar a senha." onSelect={() => { setMode('email_invite'); setPassword(''); setConfirmation(''); }} />
              <ModeCard checked={mode === 'initial_password'} title="Definir senha inicial" description="O owner informa a senha; ela é usada no servidor e não fica armazenada no console." onSelect={() => setMode('initial_password')} />
            </div>
          </fieldset>

          {mode === 'initial_password' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField label="Senha inicial" value={password} show={showPassword} onChange={setPassword} onToggle={() => setShowPassword((value) => !value)} />
              <PasswordField label="Confirmar senha" value={confirmation} show={showPassword} onChange={setConfirmation} />
              <p className="text-xs text-muted-foreground sm:col-span-2">Mínimo de 8 caracteres, com pelo menos uma letra e um número. Envie a senha por um canal seguro.</p>
            </div>
          )}

          {mode === 'email_invite' && (
            <Alert>
              <Mail className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>O link de autenticação não usa nem altera tokens de cadastro ou convites de organização.</AlertDescription>
            </Alert>
          )}
          {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
            <Button type="button" onClick={requestProvisioning}>{mode === 'email_invite' ? 'Revisar e enviar convite' : 'Revisar e criar conta'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HighRiskDialog
        open={confirming}
        title={mode === 'email_invite' ? 'Confirmar convite do cliente' : 'Confirmar criação com senha inicial'}
        description="A operação exige MFA, justificativa e será registrada na auditoria sem armazenar senha ou token."
        confirmLabel={mode === 'email_invite' ? 'Enviar convite' : 'Criar conta'}
        onClose={() => setConfirming(false)}
        onConfirm={async (reason) => {
          const result = await mutation.mutateAsync({
            name: name.trim(), email: email.trim().toLowerCase(), mode,
            password: mode === 'initial_password' ? password : undefined,
            reason,
          });
          setPassword('');
          setConfirmation('');
          setConfirming(false);
          onSaved(result.customer_id!);
        }}
      />
    </>
  );
}

function ModeCard({ checked, title, description, onSelect }: { checked: boolean; title: string; description: string; onSelect: () => void }) {
  return (
    <label className={`cursor-pointer rounded-lg border p-4 focus-within:ring-2 focus-within:ring-ring ${checked ? 'border-primary bg-success-soft ring-1 ring-primary' : 'bg-card'}`}>
      <span className="flex items-start gap-3">
        <input type="radio" name="provisioning-mode" checked={checked} onChange={onSelect} className="mt-1" />
        <span><b className="block text-sm">{title}</b><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span>
      </span>
    </label>
  );
}

function Field({ label, type = 'text', value, onChange, autoComplete }: { label: string; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  const id = `individual-${label.toLowerCase()}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} required type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} /></div>;
}

function PasswordField({ label, value, show, onChange, onToggle }: { label: string; value: string; show: boolean; onChange: (value: string) => void; onToggle?: () => void }) {
  const id = `individual-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" className="pr-12" />
        {onToggle && <Button type="button" variant="ghost" size="icon" onClick={onToggle} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-1 top-1 h-8 w-8">{show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</Button>}
      </div>
    </div>
  );
}
