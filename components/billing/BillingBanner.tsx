import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { StateBanner } from '../ui';
import {
  BillingInvoice,
  diasParaVencimento,
  fetchMinhasFaturas,
  formatarData,
} from '../../utils/billing';

const DIAS_AVISO = 10;

/**
 * Banner de cobrança no topo do dashboard:
 * - org suspensa  → vermelho fixo, aponta para a tela de assinatura
 * - fatura vencida → vermelho
 * - fatura perto do vencimento (≤ 10 dias) → amarelo
 * - caso contrário → não renderiza nada
 */
export default function BillingBanner() {
  const { profile } = useAuth();
  const { context } = useSubscription();
  const [proxima, setProxima] = useState<BillingInvoice | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!profile?.organizationId) return;
    fetchMinhasFaturas()
      .then(lista => {
        if (!ativo) return;
        const abertas = lista
          .filter(f => f.status === 'aberta' || f.status === 'vencida')
          .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
        setProxima(abertas[0] ?? null);
      })
      .catch(() => { /* banner opcional — falha silenciosa */ });
    return () => { ativo = false; };
  }, [profile?.organizationId]);

  const orgSuspensa = context?.organization?.status === 'suspended'
    || context?.subscription?.status === 'suspended'
    || context?.subscription?.status === 'past_due';

  const irParaCobranca = () => router.push('/(panel)/assinatura');

  if (orgSuspensa) {
    return (
      <StateBanner
        variant="danger"
        title="Assinatura suspensa"
        description="O acesso está limitado por pendência de pagamento. Regularize para voltar a usar todos os recursos."
        actionLabel="Regularizar"
        onAction={irParaCobranca}
      />
    );
  }

  if (!proxima) return null;

  const dias = diasParaVencimento(proxima.vencimento);

  if (proxima.status === 'vencida' || dias < 0) {
    return (
      <StateBanner
        variant="danger"
        title="Fatura vencida"
        description={`A cobrança de ${formatarData(proxima.vencimento)} está em atraso. Anexe o comprovante para evitar a suspensão.`}
        actionLabel="Anexar comprovante"
        onAction={irParaCobranca}
      />
    );
  }

  if (dias <= DIAS_AVISO) {
    return (
      <StateBanner
        variant="warning"
        title={dias === 0 ? 'Sua fatura vence hoje' : `Seu plano vence em ${dias} dia${dias === 1 ? '' : 's'}`}
        description={`Cobrança de ${formatarData(proxima.vencimento)}. Pague por PIX e anexe o comprovante no app.`}
        actionLabel="Ver fatura"
        onAction={irParaCobranca}
      />
    );
  }

  return null;
}
