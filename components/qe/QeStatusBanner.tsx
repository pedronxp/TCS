import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { StateBanner } from '../ui';

interface QeStatus {
  status: 'pendente' | 'aprovada' | 'devolvida';
  ciclo: number;
  nota: number | null;
  parecer: string | null;
}

/**
 * Selo de controle de qualidade (QE) exibido na tela da vistoria.
 * QE é retroativa: nunca bloqueia o agente — apenas informa o estado.
 */
export default function QeStatusBanner({ vistoriaId }: { vistoriaId?: string }) {
  const [qe, setQe] = useState<QeStatus | null>(null);

  useEffect(() => {
    if (!vistoriaId) return;
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('qe_status_vistoria', { p_vistoria_id: vistoriaId });
        if (ativo && !error && Array.isArray(data) && data.length > 0) {
          setQe(data[0] as QeStatus);
        }
      } catch {
        /* selo opcional — falha silenciosa */
      }
    })();
    return () => { ativo = false; };
  }, [vistoriaId]);

  if (!qe) return null;

  if (qe.status === 'pendente') {
    return (
      <StateBanner
        variant="info"
        title="Aguardando revisão de qualidade"
        description="Sua vistoria entrou na fila de conferência. Isso não impede seu trabalho — o laudo oficial é liberado após a aprovação."
      />
    );
  }

  if (qe.status === 'devolvida') {
    return (
      <StateBanner
        variant="warning"
        title={`Devolvida para correção${qe.ciclo > 1 ? ` (ciclo ${qe.ciclo})` : ''}`}
        description={qe.parecer ?? 'Corrija os pontos sinalizados e reenvie a vistoria.'}
      />
    );
  }

  return (
    <StateBanner
      variant="success"
      title={`Aprovada na revisão de qualidade${qe.nota != null ? ` — nota ${qe.nota}/10` : ''}`}
      description="Vistoria conferida e liberada para laudo oficial."
    />
  );
}
