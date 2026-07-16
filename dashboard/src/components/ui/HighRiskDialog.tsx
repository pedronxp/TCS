import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="high-risk-title" aria-describedby="high-risk-description" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><div className="rounded-xl bg-amber-100 p-2 text-amber-700"><ShieldCheck className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 id="high-risk-title" className="text-lg font-bold">{title}</h2><p id="high-risk-description" className="mt-1 text-sm text-slate-500">{description}</p></div><button ref={closeRef} onClick={onClose} aria-label="Fechar confirmação" className="rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><X className="h-5 w-5" /></button></div>{aal2 ? <div className="mt-5"><label className="text-sm font-semibold" htmlFor="high-risk-reason">Justificativa</label><textarea id="high-risk-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" placeholder="Explique por que esta ação é necessária" /><button disabled={busy} onClick={() => void confirm()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}</button></div> : <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-semibold text-blue-900">Confirmação forte necessária</p>{hasVerifiedFactor === false && !enrollment ? <><p className="mt-1 text-xs text-blue-700">Cadastre um aplicativo autenticador para proteger as operações administrativas.</p><button disabled={busy} onClick={() => void enrollMfa()} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Configurar autenticador</button></> : <>{enrollment && <div className="mt-3 rounded-lg bg-white p-3"><img src={enrollment.qrCode} alt="QR code para cadastrar o TCS Console no autenticador" className="mx-auto h-44 w-44" /><p className="mt-2 text-center text-xs text-slate-500">Se não puder escanear, use o segredo:</p><code className="mt-1 block break-all rounded bg-slate-100 p-2 text-center text-xs">{enrollment.secret}</code></div>}<p className="mt-3 text-xs text-blue-700">Digite o código de 6 dígitos do autenticador para elevar esta sessão a aal2.</p><div className="mt-3 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" aria-label="Código do autenticador" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-center font-mono tracking-[.3em]" /><button disabled={busy || code.length !== 6} onClick={() => void verifyMfa()} className="rounded-lg bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-50">Verificar</button></div></>}</div>}{error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}</div></div>;
}
