import React, { createContext, useContext, useState } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ReportDraft {
  vistoriaId: string;
  protocolo: string;           // ID curto para exibição
  endereco: string;
  municipio: string;
  agenteNome: string;
  dataVistoria: string;
  formularioId: string;
  nivelRisco: string;
  pontuacaoTotal: number;
  respostas: Record<string, string>; // id → valor
  foto_url?: string | null;
  fotosUrls?: string[] | null;
  // Campos editáveis pelo técnico
  condutaRecomendada: string;
  observacoesTecnicas: string;
  cargo: string;
  geradoEm: string;
}

interface ReportContextValue {
  draft: ReportDraft | null;
  /** Inicializa o draft a partir dos dados da vistoria */
  initReport: (data: Omit<ReportDraft, 'geradoEm'>) => void;
  /** Atualiza um campo editável do draft */
  updateField: <K extends keyof ReportDraft>(field: K, value: ReportDraft[K]) => void;
  /** Limpa o draft atual */
  clearReport: () => void;
}

const CONDUTA_DEFAULT: Record<string, string> = {
  r1: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina conforme normas técnicas vigentes.',
  r2: 'Foram identificadas irregularidades estruturais que requerem atenção. Recomenda-se laudo técnico complementar por engenheiro habilitado e medidas de reforço em curto prazo.',
  r3: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação dos ocupantes até emissão de laudo estrutural por engenheiro habilitado (CREA/CAU).',
  r4: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar a Defesa Civil municipal e Corpo de Bombeiros. Interdição obrigatória. Proibido o reingresso sem autorização técnica.',
};

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<ReportDraft | null>(null);

  const initReport = (data: Omit<ReportDraft, 'geradoEm'>) => {
    setDraft({
      ...data,
      condutaRecomendada: data.condutaRecomendada || CONDUTA_DEFAULT[data.nivelRisco] || CONDUTA_DEFAULT.r1,
      observacoesTecnicas: data.observacoesTecnicas || '',
      cargo: data.cargo || 'Agente de Defesa Civil',
      geradoEm: new Date().toISOString(),
    });
  };

  const updateField = <K extends keyof ReportDraft>(field: K, value: ReportDraft[K]) => {
    setDraft(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const clearReport = () => setDraft(null);

  return (
    <ReportContext.Provider value={{ draft, initReport, updateField, clearReport }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReport must be used within ReportProvider');
  return ctx;
}

export { CONDUTA_DEFAULT };
