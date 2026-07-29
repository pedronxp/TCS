import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function HighRiskDialog({ open, title, description, confirmLabel, onClose, onConfirm }: Props) {
  const { profile, refreshAssurance } = useAuth();
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasVerifiedFactor, setHasVerifiedFactor] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    void supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError) setError(listError.message);
      setHasVerifiedFactor(Boolean(data?.totp.some((factor) => factor.status === 'verified')));
    });
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, open]);
  if (!open) return null;

  async function verifyMfa() {
    setBusy(true); setError(null);
    let factorId = enrollment?.factorId;
    if (!factorId) {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((item) => item.status === 'verified');
      if (listError || !factor) { setError(listError?.message || 'Configure um autenticador antes de continuar.'); setBusy(false); return; }
      factorId = factor.id;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) { setError(verifyError.message); setBusy(false); return; }
    await refreshAssurance();
    setHasVerifiedFactor(true);
    setEnrollment(null);
    setCode('');
    setBusy(false);
  }

  async function enrollMfa() {
    setBusy(true);
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'TCS Console',
    });
    if (enrollError) {
      setError(enrollError.message);
    } else {
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    }
    setBusy(false);
  }

  async function confirm() {
    if (reason.trim().length < 8) { setError('Informe uma justificativa com pelo menos 8 caracteres.'); return; }
    setBusy(true); setError(null);
    try { await onConfirm(reason.trim()); setReason(''); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Operação não concluída.'); }
    finally { setBusy(false); }
  }

  const aal2 = profile?.assuranceLevel === 'aal2';
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-foreground/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="high-risk-title"
        aria-describedby="high-risk-description"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-warning-soft p-2 text-warning-soft-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="high-risk-title" className="text-lg font-bold">{title}</h2>
            <p id="high-risk-description" className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar confirmação"
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {aal2 ? (
          <div className="mt-5">
            <label className="text-sm font-semibold" htmlFor="high-risk-reason">Justificativa</label>
            <Textarea
              id="high-risk-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2"
              placeholder="Explique por que esta ação é necessária"
            />
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void confirm()}
              className="mt-4 w-full"
            >
              {busy && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-info/20 bg-info-soft p-4">
            <p className="text-sm font-semibold text-foreground">Confirmação forte necessária</p>
            {hasVerifiedFactor === false && !enrollment ? (
              <>
                <p className="mt-1 text-xs text-info">
                  Cadastre um aplicativo autenticador para proteger as operações administrativas.
                </p>
                <Button type="button" disabled={busy} onClick={() => void enrollMfa()} className="mt-3">
                  Configurar autenticador
                </Button>
              </>
            ) : (
              <>
                {enrollment && (
                  <div className="mt-3 rounded-lg bg-card p-3">
                    <img
                      src={enrollment.qrCode}
                      alt="QR code para cadastrar o TCS Console no autenticador"
                      className="mx-auto h-44 w-44"
                    />
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Se não puder escanear, use o segredo:
                    </p>
                    <code className="mt-1 block break-all rounded bg-muted p-2 text-center text-xs">
                      {enrollment.secret}
                    </code>
                  </div>
                )}
                <p className="mt-3 text-xs text-info">
                  Digite o código de 6 dígitos do autenticador para elevar esta sessão a aal2.
                </p>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label="Código do autenticador"
                    className="min-w-0 flex-1 text-center font-mono tracking-[.3em]"
                  />
                  <Button
                    type="button"
                    disabled={busy || code.length !== 6}
                    onClick={() => void verifyMfa()}
                  >
                    Verificar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
