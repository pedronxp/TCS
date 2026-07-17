export type PlanAudience = 'individual' | 'organization';
export type BillingCycle = 'monthly' | 'annual' | 'custom';

export interface CommercialPlan {
  code: string;
  name: string;
  audience: PlanAudience;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  trialDays: number;
  featured?: boolean;
  customContract?: boolean;
  features: string[];
}

export const COMMERCIAL_PLANS: readonly CommercialPlan[] = [
  {
    code: 'individual_basic',
    name: 'Individual Básico',
    audience: 'individual',
    description: 'Para o profissional que está iniciando sua operação digital.',
    monthlyPriceCents: 7990,
    annualPriceCents: 79900,
    trialDays: 14,
    features: ['1 profissional', 'Até 30 vistorias', 'Relatórios essenciais', '1 GB de armazenamento'],
  },
  {
    code: 'individual_professional',
    name: 'Individual Profissional',
    audience: 'individual',
    description: 'Mais capacidade para uma rotina técnica de maior volume.',
    monthlyPriceCents: 14990,
    annualPriceCents: 149900,
    trialDays: 14,
    featured: true,
    features: ['1 profissional', 'Até 150 vistorias', 'Relatórios avançados', '5 GB de armazenamento'],
  },
  {
    code: 'municipal_basic',
    name: 'Municipal Básico',
    audience: 'organization',
    description: 'Operação essencial para pequenas equipes municipais.',
    monthlyPriceCents: 149000,
    annualPriceCents: 1490000,
    trialDays: 30,
    features: ['Até 10 agentes', 'Até 300 vistorias', 'Coordenação municipal', '20 GB de armazenamento'],
  },
  {
    code: 'municipal_professional',
    name: 'Municipal Profissional',
    audience: 'organization',
    description: 'Gestão completa para equipes municipais em expansão.',
    monthlyPriceCents: 399000,
    annualPriceCents: 3990000,
    trialDays: 30,
    featured: true,
    features: ['Até 30 agentes', 'Até 1.000 vistorias', 'Indicadores completos', 'Suporte prioritário'],
  },
  {
    code: 'municipal_complete',
    name: 'Municipal Completo',
    audience: 'organization',
    description: 'Estrutura ampliada, ARV e condições definidas por contrato.',
    monthlyPriceCents: 699000,
    annualPriceCents: 6990000,
    trialDays: 30,
    customContract: true,
    features: ['Até 100 agentes', 'Até 5.000 vistorias', 'ARV e indicadores personalizados', 'Suporte especializado'],
  },
] as const;

export function formatPlanPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function priceForCycle(plan: CommercialPlan, cycle: BillingCycle): number | null {
  if (cycle === 'custom') return null;
  return cycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents;
}
