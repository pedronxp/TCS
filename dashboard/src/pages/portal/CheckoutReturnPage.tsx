import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, ReceiptText, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { portalHome } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

type CheckoutStatus = 'pending' | 'completed' | 'failed' | 'expired';
type CheckoutState = 'checking' | CheckoutStatus;

const statusContent = {
  checking: {
    icon: LoaderCircle,
    eyebrow: 'Consulta segura',
    title: 'Consultando o estado do checkout',
    text: 'Aguarde enquanto esta página consulta o registro do servidor.',
  },
  pending: {
    icon: Clock3,
    eyebrow: 'Confirmação em andamento',
    title: 'Aguardando o provedor de pagamento',
    text: 'O checkout ainda está pendente. Esta página apenas consulta o estado registrado pelo servidor e não ativa recursos no navegador.',
  },
  completed: {
    icon: CheckCircle2,
    eyebrow: 'Confirmação recebida',
    title: 'Pagamento confirmado pelo servidor',
    text: 'O servidor registrou a confirmação do provedor para este checkout. Abra o portal para consultar os recursos disponíveis no seu acesso.',
  },
  failed: {
    icon: XCircle,
    eyebrow: 'Consulta não concluída',
    title: 'Não foi possível confirmar o checkout',
    text: 'Nenhum recurso foi ativado por esta página. Volte ao portal para conferir a contratação ou fale com o suporte.',
  },
  expired: {
    icon: AlertCircle,
    eyebrow: 'Checkout encerrado',
    title: 'O prazo deste checkout expirou',
    text: 'Nenhuma assinatura foi ativada por este retorno. Inicie uma nova contratação para continuar.',
  },
} as const;

export function CheckoutReturnPage() {
  const [params] = useSearchParams();
  const checkoutId = params.get('checkout');
  const { access, refreshAccess } = usePortalAuth();
  const [status, setStatus] = useState<CheckoutState>('checking');

  useEffect(() => {
    if (!checkoutId) {
      setStatus('failed');
      return;
    }
    setStatus('checking');
    let active = true;
    let timeout: number | undefined;
    const portalRpc = supabase.rpc.bind(supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

    async function poll() {
      const { data, error } = await portalRpc('portal_get_checkout_status', { p_checkout_id: checkoutId });
      if (!active) return;
      const next = (data as { status?: unknown } | null)?.status;
      if (error || !isCheckoutStatus(next)) {
        setStatus('failed');
        return;
      }
      setStatus(next);
      if (next === 'completed') {
        try {
          await refreshAccess();
        } catch {
          // A confirmação do checkout continua sendo autoritativa mesmo se a
          // atualização local do contexto precisar ser refeita no portal.
        }
      }
      if (next === 'pending') timeout = window.setTimeout(() => void poll(), 2500);
    }

    void poll();
    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [checkoutId, refreshAccess]);

  const content = statusContent[status];
  const Icon = content.icon;
  const portalDestination = access ? portalHome(access.accountKind) : '/entrar';
  const isCompleted = status === 'completed';
  const isChecking = status === 'checking';

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4 sm:p-8">
      <Card className="w-full max-w-xl overflow-hidden">
        <CardContent className="p-0" aria-live="polite">
          <div className="border-b bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />Confirmação consultada no servidor TCS</div>
          </div>
          <section className="p-6 sm:p-8" role="status">
            <span className={`grid h-12 w-12 place-items-center rounded-lg ${isCompleted ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`} aria-hidden="true"><Icon className={`h-6 w-6 ${isChecking ? 'animate-spin motion-reduce:animate-none' : ''}`} /></span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-primary">{content.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{content.title}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.text}</p>

            <div className="mt-6 rounded-lg border bg-secondary/50 p-4 text-sm">
              <div className="flex gap-3"><ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><div><p className="font-semibold">Referência do checkout</p><p className="mt-1 break-all text-xs text-muted-foreground">{checkoutId || 'Não informada'}</p></div></div>
            </div>

            {!isChecking && <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {status === 'expired' ? (
                <Button asChild><Link to="/planos">Ver opções de contratação</Link></Button>
              ) : (
                <Button asChild variant={isCompleted ? 'default' : 'outline'}><Link to={portalDestination}>{isCompleted ? 'Abrir portal' : 'Voltar ao portal'}</Link></Button>
              )}
              {(status === 'failed' || status === 'expired') && (
                <Button asChild variant="ghost"><a href="mailto:suporte@tcs.app?subject=Ajuda%20com%20checkout">Falar com o suporte</a></Button>
              )}
            </div>}
            {status === 'pending' && <p className="mt-4 text-xs leading-5 text-muted-foreground">A consulta será repetida automaticamente enquanto esta página permanecer aberta.</p>}
          </section>
        </CardContent>
      </Card>
    </main>
  );
}

function isCheckoutStatus(value: unknown): value is CheckoutStatus {
  return value === 'pending' || value === 'completed' || value === 'failed' || value === 'expired';
}
