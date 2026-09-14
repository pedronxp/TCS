import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, QrCode, RefreshCw, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { prepareBotSessionPairing, fetchBotQrObjectUrl, fetchBotSessaoStatus, requestBotPairingCode, restartBotSessionPairing } from '@/lib/comunicados';

interface WhatsAppPairingDialogProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_QR_ATTEMPTS = 15;

export function WhatsAppPairingDialog({ sessionId, open, onOpenChange }: WhatsAppPairingDialogProps) {
  const [method, setMethod] = useState<'qr' | 'code'>('qr');
  const [phone, setPhone] = useState('');
  const [identification, setIdentification] = useState('');
  const [prepared, setPrepared] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);

  const sessionStatus = useQuery({
    queryKey: ['bot', 'pairing-status', sessionId],
    queryFn: () => fetchBotSessaoStatus(sessionId as string),
    enabled: open && prepared && Boolean(sessionId),
    refetchInterval: 3_000,
  });
  const linked = sessionStatus.data?.fase === 'vinculado';

  const prepare = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('Sessão inexistente. Feche esta janela e tente novamente.');
      await prepareBotSessionPairing({ sessionId, phone, identification, method });
      return method === 'code' ? requestBotPairingCode(sessionId, phone) : null;
    },
    onSuccess: (nextCode) => {
      setPrepared(true);
      setCode(nextCode);
      setQrAttempt(0);
      setQrError(null);
    },
  });

  const restart = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('Sessão inexistente. Feche esta janela e tente novamente.');
      await prepareBotSessionPairing({ sessionId, phone, identification, method: 'qr' });
      await restartBotSessionPairing(sessionId);
    },
    onSuccess: () => {
      setQrImage(null);
      setQrError(null);
      setQrAttempt(0);
    },
    onError: (error: Error) => setQrError(error.message),
  });

  useEffect(() => {
    if (!open || !sessionId || !prepared || linked || method !== 'qr' || qrAttempt >= MAX_QR_ATTEMPTS) return undefined;
    let active = true;
    let objectUrl: string | null = null;
    let timer: number | undefined;
    setQrLoading(true);
    void fetchBotQrObjectUrl(sessionId).then((nextUrl) => {
      if (!active) { URL.revokeObjectURL?.(nextUrl); return; }
      objectUrl = nextUrl;
      setQrImage(nextUrl);
      setQrError(null);
      setQrLoading(false);
      timer = window.setTimeout(() => setQrAttempt((current) => current + 1), 15_000);
    }).catch((error: unknown) => {
      if (!active) return;
      setQrImage(null);
      setQrError(error instanceof Error ? error.message : 'Falha de comunicação com o serviço do WhatsApp.');
      setQrLoading(false);
      timer = window.setTimeout(() => setQrAttempt((current) => current + 1), 6_000);
    });
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL?.(objectUrl);
    };
  }, [linked, method, open, prepared, qrAttempt, sessionId]);

  function resetIdentification() {
    setPrepared(false);
    setCode(null);
    setQrImage(null);
    setQrError(null);
    setQrAttempt(0);
    prepare.reset();
    restart.reset();
  }

  const phoneValid = phone.replace(/\D/g, '').length >= 10;

  return (
    <Dialog open={open && Boolean(sessionId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b bg-secondary/20 px-5 pb-4 pt-5 sm:px-6">
          <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></span>
          <DialogTitle>{linked ? 'WhatsApp vinculado com sucesso' : prepared ? method === 'qr' ? 'Escaneie o QR Code' : 'Digite o código no WhatsApp' : 'Identifique o número'}</DialogTitle>
          <DialogDescription className="pt-1 leading-5">{linked ? `Conta vinculada: ${sessionStatus.data?.telefone ?? phone}${identification ? ` · ${identification}` : ''}.` : prepared ? `Conta esperada: ${phone}${identification ? ` · ${identification}` : ''}.` : 'O sistema só confirmará o vínculo se a conta conectada corresponder ao número informado.'}</DialogDescription>
        </DialogHeader>

        {!prepared ? (
          <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={(event) => { event.preventDefault(); prepare.mutate(); }}>
            <label className="grid gap-2 text-sm font-medium">Número do WhatsApp com DDD
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(32) 98479-2322" autoFocus />
            </label>
            <label className="grid gap-2 text-sm font-medium">Identificação <span className="font-normal text-muted-foreground">(opcional)</span>
              <Input value={identification} onChange={(event) => setIdentification(event.target.value)} maxLength={80} placeholder="Defesa Civil, Atendimento…" />
            </label>
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Forma de conexão</legend><div className="grid gap-2 sm:grid-cols-2">
              <button type="button" aria-pressed={method === 'qr'} onClick={() => setMethod('qr')} className={`min-h-20 rounded-xl border p-3 text-left transition-colors active:scale-[.98] motion-reduce:transform-none ${method === 'qr' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-secondary/40'}`}><QrCode className="h-5 w-5 text-primary" /><span className="mt-2 block text-sm font-semibold">QR Code</span><span className="mt-1 block text-xs text-muted-foreground">Escanear com o celular</span></button>
              <button type="button" aria-pressed={method === 'code'} onClick={() => setMethod('code')} className={`min-h-20 rounded-xl border p-3 text-left transition-colors active:scale-[.98] motion-reduce:transform-none ${method === 'code' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-secondary/40'}`}><KeyRound className="h-5 w-5 text-primary" /><span className="mt-2 block text-sm font-semibold">Código</span><span className="mt-1 block text-xs text-muted-foreground">Digitar no WhatsApp</span></button>
            </div></fieldset>
            {prepare.error && <p className="rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{prepare.error.message}</p>}
            <Button type="submit" className="w-full" disabled={prepare.isPending || !phoneValid}>{prepare.isPending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : method === 'qr' ? <QrCode /> : <KeyRound />}{prepare.isPending ? 'Preparando conexão…' : method === 'qr' ? 'Gerar QR Code' : 'Gerar código'}</Button>
          </form>
        ) : linked ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div className="flex gap-3 rounded-xl border border-success/30 bg-success-soft p-4 text-sm leading-6"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /><p>O vínculo foi confirmado pelo WhatsApp. A conta só será usada dentro desta organização.</p></div>
            <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />O que o painel poderá fazer</p><ul className="mt-3 space-y-2 text-sm leading-5 text-muted-foreground"><li>• Consultar grupos e Canais visíveis para este número.</li><li>• Receber nome e telefone dos contatos que o WhatsApp disponibilizar para criar listas no painel.</li><li>• Enviar comunicados somente aos destinos que você configurar.</li></ul></div>
            <div className="rounded-xl bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground"><p className="flex items-center gap-2 font-medium text-foreground"><Users className="h-4 w-4" />Limites e controle</p><p className="mt-2">O painel não altera a agenda do celular. Contatos sincronizados ficam restritos a esta organização e podem ser removidos individualmente ou apagados por completo a qualquer momento.</p></div>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>Entendi e continuar</Button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {method === 'qr' ? <>
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-secondary/15 p-4">
                {qrImage ? <img alt="QR Code de vinculação do WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" src={qrImage} /> : qrLoading ? <div className="text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary motion-reduce:animate-none" /><p className="mt-3 text-sm font-medium">Preparando QR Code</p></div> : <div className="max-w-xs text-center"><QrCode className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">QR Code ainda não disponível</p></div>}
              </div>
              {qrError && <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm leading-5" role="status">{qrError}{qrAttempt < MAX_QR_ATTEMPTS ? ` Tentativa automática ${Math.min(qrAttempt + 1, MAX_QR_ATTEMPTS)} de ${MAX_QR_ATTEMPTS}.` : ''}</p>}
              {qrAttempt >= MAX_QR_ATTEMPTS && <Button type="button" className="w-full" variant="outline" disabled={restart.isPending} onClick={() => restart.mutate()}>{restart.isPending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <RefreshCw />}{restart.isPending ? 'Reiniciando conexão…' : 'Tentar novamente'}</Button>}
              <p className="text-xs leading-5 text-muted-foreground">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O QR é renovado de forma controlada.</p>
            </> : <>
              <div className="rounded-2xl border border-success/25 bg-success-soft p-6 text-center" role="status"><p className="text-xs text-muted-foreground">Digite este código no WhatsApp.</p><p className="mt-3 font-mono text-2xl font-semibold tracking-[0.2em]">{code}</p></div>
              <p className="text-xs leading-5 text-muted-foreground">No celular: WhatsApp → Aparelhos conectados → Vincular com número de telefone.</p>
            </>}
            <Button type="button" variant="ghost" className="w-full" onClick={resetIdentification}><ArrowLeft />Corrigir número ou método</Button>
          </div>
        )}
        <div className="mx-5 mb-5 flex gap-2 rounded-xl bg-secondary/30 px-3 py-2.5 text-xs leading-5 text-muted-foreground sm:mx-6"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />O vínculo só muda para conectado depois da confirmação do WhatsApp e da validação da conta esperada.</div>
      </DialogContent>
    </Dialog>
  );
}
