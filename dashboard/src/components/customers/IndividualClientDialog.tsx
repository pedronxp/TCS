import { useEffect, useState } from 'react';
import { Eye, EyeOff, Mail, X } from 'lucide-react';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import {
  type IndividualProvisioningMode,
  useIndividualClientProvisioning,
} from '@/hooks/useIndividualClientProvisioning';

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
    if (!open) {
      setPassword('');
      setConfirmation('');
      setConfirming(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

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

  return <>
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="individual-client-title" className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="individual-client-title" className="text-xl font-bold">Novo cliente individual</h2>
            <p className="mt-1 text-sm text-muted-foreground">Crie a conta por convite de e-mail ou defina uma senha inicial.</p>
          </div>
          <button onClick={close} aria-label="Fechar formulário" className="rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
          <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Como liberar o acesso?</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <ModeCard
              checked={mode === 'email_invite'}
              title="Enviar convite por e-mail"
              description="O Supabase envia um link temporário e de uso único para o cliente criar a senha."
              onSelect={() => { setMode('email_invite'); setPassword(''); setConfirmation(''); }}
            />
            <ModeCard
              checked={mode === 'initial_password'}
              title="Definir senha inicial"
              description="O owner informa a senha; ela é usada no servidor e não fica armazenada no console."
              onSelect={() => setMode('initial_password')}
            />
          </div>
        </fieldset>

        {mode === 'initial_password' && <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <PasswordField label="Senha inicial" value={password} show={showPassword} onChange={setPassword} onToggle={() => setShowPassword((value) => !value)} />
          <PasswordField label="Confirmar senha" value={confirmation} show={showPassword} onChange={setConfirmation} />
          <p className="sm:col-span-2 text-xs text-muted-foreground">Mínimo de 8 caracteres, com pelo menos uma letra e um número. Envie a senha ao cliente por um canal seguro.</p>
        </div>}

        {mode === 'email_invite' && <div className="mt-5 flex gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-sm text-info"><Mail className="mt-0.5 h-5 w-5 shrink-0" /><p>O link de autenticação não usa nem altera os tokens de cadastro ou os convites de organização do sistema.</p></div>}
        {error && <p className="mt-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={close} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary">Cancelar</button>
          <button onClick={requestProvisioning} className="bg-primary rounded-lg px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover">{mode === 'email_invite' ? 'Revisar e enviar convite' : 'Revisar e criar conta'}</button>
        </div>
      </div>
    </div>
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
  </>;
}

function ModeCard({ checked, title, description, onSelect }: { checked: boolean; title: string; description: string; onSelect: () => void }) {
  return <label className={`cursor-pointer rounded-lg border p-4 ${checked ? 'border-primary bg-success-soft ring-1 ring-primary' : 'bg-card'}`}>
    <span className="flex items-start gap-3"><input type="radio" checked={checked} onChange={onSelect} className="mt-1" /><span><b className="block text-sm">{title}</b><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span></span>
  </label>;
}

function Field({ label, type = 'text', value, onChange, autoComplete }: { label: string; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  return <label className="text-sm"><span className="font-semibold">{label}</span><input required type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="mt-1 h-10 w-full rounded-lg border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>;
}

function PasswordField({ label, value, show, onChange, onToggle }: { label: string; value: string; show: boolean; onChange: (value: string) => void; onToggle?: () => void }) {
  return <label className="text-sm"><span className="font-semibold">{label}</span><span className="relative mt-1 block"><input type={show ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" className="h-10 w-full rounded-lg border px-3 pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />{onToggle && <button type="button" onClick={onToggle} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-2 top-2 rounded p-1">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}</span></label>;
}
