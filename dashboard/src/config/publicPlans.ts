export type PublicPlanAudience = 'individual' | 'municipal';

export interface PublicPlan {
  id: string;
  audience: PublicPlanAudience;
  name: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  description: string;
  limits: string[];
  highlighted?: boolean;
  contractualBase?: boolean;
}

// Fonte pública, sanitizada e versionada conforme docs/planos-comerciais-aprovados.md.
// Nenhuma consulta autenticada ou credencial interna é necessária para renderizar o site.
export const PUBLIC_PLANS: readonly PublicPlan[] = [
  { id: 'individual-basic', audience: 'individual', name: 'Individual Básico', monthlyPriceCents: 7990, annualPriceCents: 79900, description: 'Para profissionais que precisam padronizar vistorias e relatórios.', limits: ['30 vistorias por mês', '1 GB de armazenamento', 'Suporte por e-mail'] },
  { id: 'individual-professional', audience: 'individual', name: 'Individual Profissional', monthlyPriceCents: 14990, annualPriceCents: 149900, description: 'Mais capacidade para uma rotina técnica intensa e organizada.', limits: ['150 vistorias por mês', '5 GB de armazenamento', 'Suporte prioritário'], highlighted: true },
  { id: 'municipal-basic', audience: 'municipal', name: 'Municipal Básico', monthlyPriceCents: 149000, annualPriceCents: 1490000, description: 'Operação municipal inicial com equipe coordenada e visão central.', limits: ['Até 10 agentes', '300 vistorias por mês', '20 GB de armazenamento'] },
  { id: 'municipal-professional', audience: 'municipal', name: 'Municipal Profissional', monthlyPriceCents: 399000, annualPriceCents: 3990000, description: 'Escala para equipes maiores, indicadores e suporte prioritário.', limits: ['Até 30 agentes', '1.000 vistorias por mês', '100 GB de armazenamento'], highlighted: true },
  { id: 'municipal-complete', audience: 'municipal', name: 'Municipal Completo', monthlyPriceCents: 699000, annualPriceCents: 6990000, description: 'Base contratual para operações amplas e atendimento especializado.', limits: ['Base de 100 agentes', '5.000 vistorias por mês', '500 GB de armazenamento'], contractualBase: true },
] as const;

export function formatPublicPlanPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(cents / 100);
}
