import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, LoaderCircle, QrCode, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { fetchBotQrObjectUrl, requestBotPairingCode } from '@/lib/comunicados';

interface WhatsAppPairingDialogProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppPairingDialog({ sessionId, open, onOpenChange }: WhatsAppPairingDialogProps) {
  const [method, setMethod] = useState<'qr' | 'code'>('qr');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!open || !sessionId || method !== 'qr') return undefined;

    let active = true;
    const objectUrls = new Set<string>();
    const loadQr = async () => {
      try {
        const objectUrl = await fetchBotQrObjectUrl(sessionId);
        if (!active) {
          URL.revokeObjectURL?.(objectUrl);
          return;
        }
        objectUrls.add(objectUrl);
        setQrImage(objectUrl);
        setQrError(null);
      } catch (error) {
        if (active) setQrError(error instanceof Error ? error.message : 'Aguardando a geração do QR Code.');
      }
    };

    void loadQr();
    const timer = window.setInterval(() => void loadQr(), 12_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      for (const objectUrl of objectUrls) URL.revokeObjectURL?.(objectUrl);
    };
  }, [method, open, refreshToken, sessionId]);

  const pairingCode = useMutation({
    mutationFn: () => requestBotPairingCode(sessionId as string, phone),
    onSuccess: (nextCode) => setCode(nextCode),
  });

  function selectMethod(nextMethod: 'qr' | 'code') {
    setMethod(nextMethod);
    setQrError(null);
    pairingCode.reset();
  }

  return (
    <Dialog open={open && Boolean(sessionId)} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b bg-secondary/20 px-6 pb-5 pt-6 sm:px-8">
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></span>
          <DialogTitle>Vincular número ao WhatsApp</DialogTitle>
          <DialogDescription className="pt-2 leading-6">Conecte o aparelho oficial da organização com o QR Code ou com um código digitado no celular.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-secondary/25 p-1.5">
            <Button type="button" variant={method === 'qr' ? 'default' : 'ghost'} onClick={() => selectMethod('qr')}><QrCode />Usar QR Code</Button>
            <Button type="button" variant={method === 'code' ? 'default' : 'ghost'} onClick={() => selectMethod('code')}><KeyRound />Usar código de vinculação</Button>
          </div>

          {method === 'qr' ? (
            <div className="space-y-4">
              <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed bg-secondary/15 p-5">
                {qrImage
                  ? <img alt="QR Code de vinculação do WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" src={qrImage} />
                  : <div className="max-w-xs text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm font-medium">Preparando seu QR Code</p><p className="mt-1 text-xs leading-5 text-muted-foreground">O serviço pode precisar de alguns segundos para iniciar a sessão.</p></div>}
              </div>
              {qrError && <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm leading-5" role="status">{qrError} A tentativa será renovada automaticamente.</p>}
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xs text-xs leading-5 text-muted-foreground">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.</p><Button type="button" size="sm" variant="outline" onClick={() => setRefreshToken((current) => current + 1)}><RefreshCw />Atualizar QR</Button></div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => {
              event.preventDefault();
              setCode(null);
              pairingCode.mutate();
            }}>
              <label className="grid gap-2 text-sm font-medium">Telefone do WhatsApp
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(32) 98479-2322" />
              </label>
              <p className="text-xs leading-5 text-muted-foreground">Informe o número com DDD. No WhatsApp, escolha Aparelhos conectados → Vincular com número de telefone.</p>
              <Button type="submit" className="w-full" disabled={pairingCode.isPending || phone.replace(/\D/g, '').length < 10}><KeyRound />{pairingCode.isPending ? 'Gerando código…' : 'Gerar código'}</Button>
              {pairingCode.error && <p className="rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{pairingCode.error.message}</p>}
              {code && <div className="rounded-2xl border border-success/25 bg-success-soft p-5 text-center" role="status"><p className="text-xs text-muted-foreground">Digite este código no WhatsApp do celular.</p><p className="mt-3 font-mono text-2xl font-semibold tracking-[0.25em]">{code}</p></div>}
            </form>
          )}

          <div className="flex gap-2 rounded-xl bg-secondary/30 px-3 py-2.5 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />A conexão e os grupos ficam disponíveis apenas para responsáveis autorizados da organização.</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
