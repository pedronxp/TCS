import { Check, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  formatPublicPlanPrice,
  getPublicPlansForAudience,
  type PublicPlan,
  type PublicPlanAudience,
} from '@/config/publicPlans';

const audiences: Array<{
  id: PublicPlanAudience;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: 'individual',
    label: 'Individual',
    title: 'Para quem realiza e entrega as próprias vistorias',
    description: 'Escolha pela quantidade de vistorias mensais. A contratação começa pela criação da conta.',
  },
  {
    id: 'municipal',
    label: 'Municipal',
    title: 'Para prefeituras que coordenam agentes e território',
    description: 'Escolha pelo tamanho da equipe e da operação. A contratação passa por proposta comercial.',
  },
];

export function PlansCatalogPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 lg:px-12 xl:px-16 xl:py-16 space-y-12">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Catálogo Público de Planos</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          Escolha o plano ideal para a sua operação.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Profissionais contratam uma conta individual com setup imediato. Prefeituras comparam número de agentes, volume de vistorias e capacidade de armazenamento.
        </p>
        <nav className="mt-6 flex flex-wrap gap-3" aria-label="Escolher tipo de plano">
          {audiences.map((audience) => (
            <Button key={audience.id} asChild variant={audience.id === 'individual' ? 'default' : 'outline'} className="rounded-xl">
              <a href={`#${audience.id}`}>Ver planos {audience.label.toLowerCase()}</a>
            </Button>
          ))}
        </nav>
      </header>

      {audiences.map((audience) => {
        const plans = getPublicPlansForAudience(audience.id);
        return (
          <section key={audience.id} id={audience.id} className="scroll-mt-6 border-t border-border/60 pt-12" aria-labelledby={`${audience.id}-title`}>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{audience.label}</p>
              <h2 id={`${audience.id}-title`} className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{audience.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{audience.description}</p>
            </div>
            <div className={`mt-8 grid gap-6 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
              {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
            </div>
          </section>
        );
      })}

      <Card className="rounded-2xl border-border/80 bg-card p-6 shadow-xs" aria-label="Como os valores anuais são calculados">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <Sparkles className="h-4 w-4" /> Transparência nos preços
          </div>
          <h2 className="text-lg font-bold text-foreground">Mensal ou anual, sem surpresas</h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            O plano anual equivale a 10 mensalidades. Para prefeituras no plano Municipal Completo, os valores-base podem ser customizados de acordo com as diretrizes do contrato.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  const isMunicipal = plan.audience === 'municipal';
  return (
    <Card role="article" className={`flex flex-col rounded-2xl border p-6 transition-all duration-200 shadow-xs ${plan.highlighted ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-border/80 bg-card text-card-foreground hover:border-primary/40'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-2xl font-bold tracking-tight">{plan.name}</h3>
        {plan.highlighted && (
          <Badge className="rounded-lg border-primary-foreground/20 bg-primary-foreground text-primary font-bold text-[10px]">
            Mais Recomendado
          </Badge>
        )}
      </div>
      <p className={`mt-2 text-xs leading-relaxed ${plan.highlighted ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{plan.description}</p>

      <div className="mt-6 pt-4 border-t border-border/40">
        {plan.contractualBase && <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${plan.highlighted ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>Valor-base</p>}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-extrabold tracking-tight sm:text-3xl">{formatPublicPlanPrice(plan.monthlyPriceCents)}</span>
          <span className={`text-xs ${plan.highlighted ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>/ mês</span>
        </div>
        <p className={`mt-1 text-xs ${plan.highlighted ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatPublicPlanPrice(plan.annualPriceCents)} no plano anual
        </p>
      </div>

      <ul className="mt-6 space-y-2.5 flex-1" aria-label={`Limites do ${plan.name}`}>
        {plan.limits.map((limit) => (
          <li key={limit} className="flex items-center gap-2.5 text-xs font-medium">
            <Check className={`h-4 w-4 shrink-0 ${plan.highlighted ? 'text-primary-foreground' : 'text-primary'}`} aria-hidden="true" />
            <span>{limit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 pt-4 border-t border-border/40">
        {isMunicipal ? (
          <Button asChild variant={plan.highlighted ? 'secondary' : 'outline'} className={`w-full rounded-xl font-semibold ${plan.highlighted ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90' : ''}`}>
            <a href={`mailto:comercial@tcs.app?subject=${encodeURIComponent(`Solicitar proposta — ${plan.name}`)}`}>Solicitar proposta do {plan.name}</a>
          </Button>
        ) : (
          <Button asChild variant={plan.highlighted ? 'secondary' : 'default'} className={`w-full rounded-xl font-semibold ${plan.highlighted ? 'bg-primary-foreground text-primary hover:bg-primary-hover' : ''}`}>
            <Link to="/criar-conta">Continuar para criar conta</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
