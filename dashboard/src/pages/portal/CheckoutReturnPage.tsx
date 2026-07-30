import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { portalHome } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

type CheckoutStatus = 'pending' | 'completed' | 'failed' | 'expired';

export function CheckoutReturnPage() {
  const [params] = useSearchParams();
  const checkoutId = params.get('checkout');
  const { access, refreshAccess } = usePortalAuth();
  const [status, setStatus] = useState<CheckoutStatus>('pending');

  useEffect(() => {
    if (!checkoutId) {
      setStatus('failed');
      return;
    }
    let active = true;
    let timeout: number | undefined;
    const portalRpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    async function poll() {
      const { data, error } = await portalRpc('portal_get_checkout_status', { p_checkout_id: checkoutId });
      if (!active) return;
      const next = (data as { status?: CheckoutStatus } | null)?.status;
      if (error || !next) setStatus('failed');
      else {
        setStatus(next);
        if (next === 'completed') await refreshAccess();
        if (next === 'pending') timeout = window.setTimeout(() => void poll(), 2500);
      }
    }
    void poll();
    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [checkoutId, refreshAccess]);

  const content = {
    pending: { icon: Clock3, title: 'Confirmando pagamento', text: 'A confirmação vem do provedor de pagamento. Você pode manter esta página aberta.' },
    completed: { icon: CheckCircle2, title: 'Assinatura confirmada', text: 'Seu contexto de acesso foi atualizado com os recursos da versão contratada.' },
    failed: { icon: XCircle, title: 'Não foi possível consultar o checkout', text: 'Nenhum recurso foi ativado por esta página. Tente novamente ou fale com o suporte.' },
    expired: { icon: XCircle, title: 'Checkout expirado', text: 'Inicie uma nova contratação para continuar.' },
  }[status];
  const Icon = content.icon;

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-lg"><CardContent className="grid min-h-80 place-items-center p-8 text-center"><div><Icon className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-5 text-2xl font-semibold">{content.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{content.text}</p><Button asChild className="mt-6"><Link to={access ? portalHome(access.accountKind) : '/entrar'}>{status === 'pending' ? 'Ir para o portal' : 'Continuar'}</Link></Button></div></CardContent></Card>
    </main>
  );
}
