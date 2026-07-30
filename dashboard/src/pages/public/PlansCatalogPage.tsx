import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PUBLIC_PLANS, formatPublicPlanPrice } from '@/config/publicPlans';

export function PlansCatalogPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
      <header className="mx-auto max-w-3xl text-center">
        <Badge variant="info">Catálogo comercial aprovado</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Um plano para cada escala de operação.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">Preços, limites e periodicidades vêm do mesmo contrato versionado usado no checkout.</p>
      </header>
      <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Planos disponíveis">
        {PUBLIC_PLANS.map((plan) => (
          <article key={plan.id} className={`flex min-h-[360px] min-w-0 flex-col rounded-[18px] border p-6 shadow-card ${plan.highlighted ? 'border-ink-border bg-ink text-white' : 'bg-card'}`}>
            <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className={`text-xs font-bold uppercase tracking-[0.12em] ${plan.highlighted ? 'text-warm' : 'text-primary'}`}>{plan.audience === 'individual' ? 'Individual' : 'Municipal'}</p><h2 className="mt-2 text-2xl font-semibold">{plan.name}</h2></div>{plan.highlighted && <Badge className="border-warm bg-warm text-ink">Destaque</Badge>}</div>
            <p className={`mt-4 text-sm leading-6 ${plan.highlighted ? 'text-white/70' : 'text-muted-foreground'}`}>{plan.description}</p>
            <div className="mt-6 flex min-w-0 flex-wrap items-baseline gap-x-2"><span className="max-w-full text-3xl font-bold [overflow-wrap:anywhere]">{formatPublicPlanPrice(plan.monthlyPriceCents)}</span><span className={`text-xs ${plan.highlighted ? 'text-white/70' : 'text-muted-foreground'}`}>/ mês</span><p className={`mt-1 basis-full text-xs ${plan.highlighted ? 'text-white/70' : 'text-muted-foreground'}`}>ou {formatPublicPlanPrice(plan.annualPriceCents)} por ano</p></div>
            <ul className="mt-6 space-y-3">{plan.limits.map((limit) => <li key={limit} className="flex gap-2 text-sm"><Check className={`mt-0.5 h-4 w-4 ${plan.highlighted ? 'text-warm' : 'text-success'}`} />{limit}</li>)}</ul>
            {plan.audience === 'individual' ? (
              <Button asChild variant={plan.highlighted ? 'secondary' : 'default'} className={`mt-auto w-full ${plan.highlighted ? 'bg-warm text-ink hover:bg-warm/90' : ''}`}><Link to={`/criar-conta?plan=${plan.id.replace(/-/g, '_')}`}>Começar com este plano</Link></Button>
            ) : (
              <Button asChild variant={plan.highlighted ? 'secondary' : 'outline'} className={`mt-auto w-full ${plan.highlighted ? 'bg-warm text-ink hover:bg-warm/90' : ''}`}><a href={`mailto:comercial@tcs.app?subject=${encodeURIComponent(`Interesse no ${plan.name}`)}`}>{plan.contractualBase ? 'Solicitar proposta' : 'Falar com especialista'}</a></Button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
