import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 lg:px-12 xl:px-16 xl:py-16">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Planos e limites</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Primeiro, escolha como você opera.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Profissionais contratam uma conta individual. Prefeituras comparam agentes, volume de vistorias e armazenamento antes de solicitar uma proposta.
        </p>
        <nav className="mt-7 flex flex-wrap gap-3" aria-label="Escolher tipo de plano">
          {audiences.map((audience) => (
            <Button key={audience.id} asChild variant={audience.id === 'individual' ? 'default' : 'outline'}>
              <a href={`#${audience.id}`}>Ver planos {audience.label.toLocaleLowerCase('pt-BR')}</a>
            </Button>
          ))}
        </nav>
      </header>

      {audiences.map((audience) => {
        const plans = getPublicPlansForAudience(audience.id);
        return (
          <section key={audience.id} id={audience.id} className="scroll-mt-6 border-t py-12 first-of-type:mt-12" aria-labelledby={`${audience.id}-title`}>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{audience.label}</p>
              <h2 id={`${audience.id}-title`} className="mt-2 text-2xl font-semibold sm:text-3xl">{audience.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{audience.description}</p>
            </div>
            <div className={`mt-8 grid gap-4 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
              {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
            </div>
          </section>
        );
      })}

      <aside className="rounded-lg border bg-muted p-6" aria-label="Como os valores anuais são calculados">
        <h2 className="text-lg font-semibold">Mensal ou anual, sem conta escondida</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          O valor anual equivale a 10 mensalidades. O Municipal Completo exibe um valor-base, que pode ser ajustado na proposta conforme o contrato.
        </p>
      </aside>
    </div>
  );
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  const isMunicipal = plan.audience === 'municipal';
  return (
    <article className={`flex min-h-[390px] min-w-0 flex-col rounded-lg border p-6 ${plan.highlighted ? 'border-foreground bg-foreground text-background' : 'bg-card'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-2xl font-semibold">{plan.name}</h3>
        {plan.highlighted && <Badge className="border-primary bg-primary text-primary-foreground">Mais capacidade</Badge>}
      </div>
      <p className={`mt-3 text-sm leading-6 ${plan.highlighted ? 'text-background/70' : 'text-muted-foreground'}`}>{plan.description}</p>
      <div className="mt-6">
        {plan.contractualBase && <p className={`mb-1 text-xs font-medium ${plan.highlighted ? 'text-background/70' : 'text-muted-foreground'}`}>Valor-base</p>}
        <span className="text-3xl font-bold">{formatPublicPlanPrice(plan.monthlyPriceCents)}</span>
        <span className={`ml-2 text-xs ${plan.highlighted ? 'text-background/70' : 'text-muted-foreground'}`}>por mês</span>
        <p className={`mt-2 text-xs ${plan.highlighted ? 'text-background/70' : 'text-muted-foreground'}`}>
          {formatPublicPlanPrice(plan.annualPriceCents)} por ano
        </p>
      </div>
      <ul className="mt-6 space-y-3" aria-label={`Limites do ${plan.name}`}>
        {plan.limits.map((limit) => (
          <li key={limit} className="flex gap-2 text-sm">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? 'text-primary' : 'text-success'}`} aria-hidden="true" />
            {limit}
          </li>
        ))}
      </ul>
      {isMunicipal ? (
        <Button asChild variant={plan.highlighted ? 'secondary' : 'outline'} className={`mt-auto w-full ${plan.highlighted ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : ''}`}>
          <a href={`mailto:comercial@tcs.app?subject=${encodeURIComponent(`Solicitar proposta — ${plan.name}`)}`}>Solicitar proposta do {plan.name}</a>
        </Button>
      ) : (
        <Button asChild variant={plan.highlighted ? 'secondary' : 'default'} className={`mt-auto w-full ${plan.highlighted ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : ''}`}>
          <Link to="/criar-conta">Continuar para criar conta</Link>
        </Button>
      )}
    </article>
  );
}
