import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';

interface Props { open: boolean; title: string; description: string; confirmLabel: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }
interface TotpEnrollment { factorId: string; qrCode: string; secret: string }
export function HighRiskDialog({ open, title, description, confirmLabel, onClose, onConfirm }: Props) {
  const { profile, refreshAssurance } = useAuth();
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [hasVerifiedFactor, setHasVerifiedFactor] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [choice, setChoice] = useState<'existing' | 'setup' | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReason(''); setCode(''); setError(null); setEnrollment(null); setChoice(null); setHasVerifiedFactor(null);
    void (async () => {
      try {
        const { data, error: cause } = await supabase.auth.mfa.listFactors();
        if (cause) throw cause;
        if (!cancelled) setHasVerifiedFactor(Boolean(data?.totp.some(factor => factor.status === 'verified')));
      } catch { if (!cancelled) setError('Não foi possível consultar o autenticador. Confira sua conexão e tente novamente.'); }
    })();
    return () => { cancelled = true; };
  }, [open, attempt]);
  if (!open) return null;
  async function verifyMfa() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      let factorId = enrollment?.factorId;
      if (!factorId) {
        const { data, error: cause } = await supabase.auth.mfa.listFactors();
        if (cause) throw cause;
        factorId = data?.totp.find(item => item.status === 'verified')?.id;
        if (!factorId) { setChoice('setup'); throw new Error('Configure o autenticador desta conta antes de usar o código.'); }
      }
      const { error: cause } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (cause) throw new Error('Código inválido ou vencido. Use o código atual exibido no celular e confira se o horário do aparelho está automático.');
      await refreshAssurance();
      setHasVerifiedFactor(true); setEnrollment(null); setCode('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível verificar o código. Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function enrollMfa() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      if (factors?.totp.some(factor => factor.status === 'verified')) { setHasVerifiedFactor(true); throw new Error('Esta conta já possui autenticador. Use o código do aplicativo vinculado ou procure o suporte para recuperar o acesso.'); }
      // Remove only incomplete enrollments created by this console, never verified factors.
      for (const factor of factors?.all.filter(item => item.factor_type === 'totp' && item.status === 'unverified' && item.friendly_name === 'TCS Console') || []) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }
      const { data, error: cause } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TCS Console' });
      if (cause) throw cause;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch { setError('Não foi possível configurar o autenticador. Tente novamente; se já existe um vinculado à conta, use-o ou procure o suporte.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function confirm() {
    if (lock.current) return;
    if (reason.trim().length < 8) { setError('Informe uma justificativa com pelo menos 8 caracteres.'); return; }
    lock.current = true; setBusy(true); setError(null);
    try { await onConfirm(reason.trim()); setReason(''); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Operação não concluída.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const aal2 = profile?.assuranceLevel === 'aal2';
  return <Dialog open={open} onOpenChange={next => { if (!next && !busy) onClose(); }}>
    <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto motion-reduce:animate-none">
      <DialogHeader className="pr-8 text-left"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" /><div><DialogTitle>{title}</DialogTitle><DialogDescription className="mt-1">{description}</DialogDescription></div></div></DialogHeader>
      {aal2 ? <div className="mt-6"><Label htmlFor="high-risk-reason">Justificativa</Label><Textarea id="high-risk-reason" value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={500} className="mt-2" placeholder="Explique por que esta ação é necessária" /><Button disabled={busy} onClick={() => void confirm()} className="mt-5 w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}</Button></div> : <div className="mt-4 space-y-4">
        <p className="font-medium">Você já tem o código do autenticador no celular?</p><p className="text-sm text-muted-foreground">É o código de 6 dígitos que muda periodicamente. Não é o token de convite para criar uma conta.</p>
        <div className="flex flex-wrap gap-2"><Button variant={choice === 'existing' ? 'default' : 'outline'} disabled={busy} onClick={() => { setChoice('existing'); setError(null); }}>Já tenho o código</Button><Button variant={choice === 'setup' ? 'default' : 'outline'} disabled={busy} onClick={() => { setChoice('setup'); setError(null); }}>Preciso configurar</Button></div>
        {hasVerifiedFactor === null && !error ? <p role="status">Consultando a segurança da conta…</p> : null}
        {choice === 'setup' && hasVerifiedFactor === true && !enrollment ? <p className="text-sm">Esta conta já tem um autenticador vinculado. Se trocou ou perdeu o celular, recupere o autenticador ou procure o suporte. Instalar outro aplicativo sozinho não recupera os códigos antigos.</p> : null}
        {choice && hasVerifiedFactor === false && !enrollment ? <div className="rounded-lg border p-4 space-y-3"><ol className="list-decimal pl-5 space-y-2 text-sm"><li>No celular, abra a loja de aplicativos e instale um aplicativo autenticador compatível com códigos de 6 dígitos.</li><li>Abra o autenticador e escolha adicionar uma conta.</li><li>Clique abaixo e escaneie o QR code com o autenticador. Se estiver usando o painel no mesmo celular, use a chave de configuração manual.</li><li>Volte ao painel e digite o código de 6 dígitos gerado para TCS Console.</li></ol><Button disabled={busy} onClick={() => void enrollMfa()}>Configurar autenticador</Button></div> : null}
        {enrollment ? <div className="rounded-lg border p-4"><img src={enrollment.qrCode} alt="QR code para cadastrar o TCS Console no autenticador" className="mx-auto h-40 w-40" /><p className="mt-3 text-sm">Ou adicione esta chave manualmente no autenticador:</p><code className="mt-2 block break-all rounded bg-muted p-3 text-xs">{enrollment.secret}</code><p className="mt-2 text-xs text-muted-foreground">Não compartilhe esta chave. Guarde uma cópia em local seguro.</p></div> : null}
        {choice && (hasVerifiedFactor || enrollment) ? <div className="space-y-2"><Label htmlFor="authenticator-code">Código do autenticador</Label><div className="flex gap-2"><Input id="authenticator-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="min-w-0 flex-1" /><Button disabled={busy || code.length !== 6} onClick={() => void verifyMfa()}>{busy ? 'Verificando…' : 'Verificar'}</Button></div></div> : null}
        {error && hasVerifiedFactor === null ? <Button variant="outline" onClick={() => setAttempt(v => v + 1)}>Tentar novamente</Button> : null}
      </div>}
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
    </DialogContent>
  </Dialog>;
}
