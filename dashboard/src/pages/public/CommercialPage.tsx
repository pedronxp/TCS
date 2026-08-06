import { ArrowRight, Check, ClipboardCheck, Database, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TcsMark } from '@/components/brand/TcsMark';
import { AppExperienceShowcase } from '@/components/public/AppExperienceShowcase';
import { PUBLIC_PLANS } from '@/config/publicPlans';

const benefits = [
  {
    title: 'Coleta estruturada',
    text: 'Formulários, evidências e localização reunidos desde o primeiro registro.',
  },
  {
    title: 'Mapa e território',
    text: 'Cobertura, contexto regional e prioridades visíveis para toda a operação.',
  },
  {
    title: 'Laudos automáticos',
    text: 'Documentos consistentes e prontos para compartilhar sem retrabalho.',
  },
  {
    title: 'Governança e auditoria',
    text: 'Histórico completo de acessos, mudanças, decisões e exportações.',
  },
] as const;

const solutions = [
  {
    title: 'Operação em campo',
    text: 'Formulários inteligentes, trabalho offline, evidências geográficas e rotas para equipes externas.',
    action: 'Coletar com confiança',
    featured: false,
  },
  {
    title: 'Gestão territorial',
    text: 'Mapa operacional, cobertura por região, pendências e priorização baseada em contexto.',
    action: 'Decidir com contexto',
    featured: true,
  },
  {
    title: 'Governança contínua',
    text: 'Laudos, trilha de auditoria e indicadores prontos para diretoria e órgãos de controle.',
    action: 'Comprovar cada ação',
    featured: false,
  },
] as const;

const securityItems = [
  {
    title: 'Identidade protegida',
    text: 'MFA, SSO corporativo e controle granular por função.',
    icon: ShieldCheck,
  },
  {
    title: 'Dados sob controle',
    text: 'Criptografia, retenção configurável e backups verificados.',
    icon: Database,
  },
  {
    title: 'Auditoria completa',
    text: 'Histórico imutável de acesso, mudanças e exportações.',
    icon: ClipboardCheck,
  },
] as const;

const individualPlan = PUBLIC_PLANS.find((plan) => plan.id === 'individual-basic');
const municipalPlan = PUBLIC_PLANS.find((plan) => plan.id === 'municipal-basic');

function marketingPrice(priceInCents: number | undefined) {
  if (priceInCents === undefined) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: priceInCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: priceInCents % 100 === 0 ? 0 : 2,
  }).format(priceInCents / 100);
}

const plans = [
  {
    name: 'Essencial',
    description: 'Para consultores e pequenas equipes',
    price: marketingPrice(individualPlan?.monthlyPriceCents),
    cadence: 'por usuário / mês',
    features: ['Até 5 usuários', 'Formulários e relatórios', 'Suporte por e-mail'],
    action: 'Começar agora',
    featured: false,
  },
  {
    name: 'Municipal',
    description: 'Para operações públicas integradas',
    price: marketingPrice(municipalPlan?.monthlyPriceCents),
    cadence: 'a partir de / mês',
    features: ['Até 30 usuários', 'Mapa e gestão territorial', 'SLA e implantação assistida'],
    action: 'Solicitar demonstração',
    featured: true,
  },
  {
    name: 'Enterprise',
    description: 'Para redes e operações complexas',
    price: 'Sob consulta',
    cadence: 'contrato personalizado',
    features: ['Usuários e áreas ilimitadas', 'SSO, API e integrações', 'Gestor de sucesso dedicado'],
    action: 'Falar com especialista',
    featured: false,
  },
] as const;

export function CommercialPage() {
  return (
    <div className="overflow-x-clip">
      <section id="produto" className="bg-background">
        <div className="mx-auto max-w-[1440px] px-4 pb-7 pt-11 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] lg:items-center lg:gap-8 xl:gap-12">
            <div className="min-w-0">
              <h1 className="max-w-[620px] text-[36px] font-bold leading-[1.16] tracking-[-0.025em] sm:text-[42px] xl:text-[48px] xl:leading-[1.12]">
                Da vistoria em campo à decisão de gestão.
              </h1>
              <p className="mt-6 max-w-[590px] text-[15px] leading-6 text-muted-foreground sm:text-base">
                Centralize equipes, vistorias, laudos, mapas e indicadores em uma operação segura e auditável.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-[46px] px-5">
                  <a href="mailto:comercial@tcs.app?subject=Solicitação%20de%20demonstração">
                    Solicitar demonstração
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-[46px] px-5">
                  <a href="#solucoes">Conhecer a plataforma</a>
                </Button>
              </div>
              <p className="mt-8 text-[11px] font-medium text-muted-foreground">
                Implantação acompanhada · Suporte especializado · LGPD
              </p>
            </div>

            <ProductPreview />
          </div>

          <div className="mt-14 xl:mt-[50px]">
            <h2 className="max-w-[760px] text-2xl font-bold leading-[1.3]">
              Operação integrada para equipes que precisam agir com evidência.
            </h2>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {benefits.map((benefit) => (
                <article key={benefit.title} className="min-h-[142px] rounded-lg border bg-card p-5 ">
                  <span aria-hidden="true" className="block h-2.5 w-2.5 rounded-full bg-primary" />
                  <h3 className="mt-5 text-[15px] font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{benefit.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="solucoes" className="bg-card">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16 xl:py-[72px]">
          <Eyebrow>Soluções</Eyebrow>
          <h2 className="mt-3 max-w-[720px] text-[30px] font-semibold leading-[1.2] tracking-[-0.02em] sm:text-[34px]">
            Uma plataforma. Três momentos decisivos.
          </h2>
          <p className="mt-4 max-w-[740px] text-[15px] leading-6 text-muted-foreground">
            Conecte a execução no território, a leitura da gestão e a comprovação de cada decisão.
          </p>

          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {solutions.map((solution) => (
              <article
                key={solution.title}
                className={`flex min-h-[198px] flex-col rounded-lg border p-6 ${
                  solution.featured
                    ? 'border-border bg-foreground text-background'
                    : 'bg-background text-foreground'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-9 w-9 rounded-md ${solution.featured ? 'bg-primary' : 'bg-secondary'}`}
                />
                <h3 className="mt-5 text-lg font-semibold">{solution.title}</h3>
                <p className={`mt-2 text-[13px] leading-5 ${solution.featured ? 'text-background/65' : 'text-muted-foreground'}`}>
                  {solution.text}
                </p>
                <a
                  href="#planos"
                  className={`mt-auto inline-flex items-center gap-2 pt-4 text-[13px] font-semibold ${
                    solution.featured ? 'text-primary' : 'text-primary'
                  }`}
                >
                  {solution.action} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <AppExperienceShowcase />

      <section id="planos" className="bg-muted">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16 xl:py-[72px]">
          <div>
            <Eyebrow>Planos</Eyebrow>
            <h2 className="mt-3 max-w-[760px] text-[30px] font-semibold leading-[1.2] tracking-[-0.02em] sm:text-[34px]">
              Comece no tamanho certo. Evolua sem reconstruir.
            </h2>
            <p className="mt-4 max-w-[700px] text-[15px] leading-6 text-muted-foreground">
              Estrutura transparente para profissionais, municípios e operações de maior escala.
            </p>
          </div>

          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex min-h-[294px] flex-col rounded-lg border p-6 ${
                  plan.featured
                    ? 'border-border bg-foreground text-background '
                    : 'bg-card text-foreground '
                }`}
              >
                {plan.featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-foreground">
                    Mais escolhido
                  </span>
                )}
                <h3 className="text-[22px] font-semibold">{plan.name}</h3>
                <p className={`mt-1 text-[13px] ${plan.featured ? 'text-background/60' : 'text-muted-foreground'}`}>
                  {plan.description}
                </p>
                <div className="mt-5">
                  <span className="text-[28px] font-bold leading-none">{plan.price}</span>
                  <span className={`ml-2 text-xs ${plan.featured ? 'text-background/55' : 'text-muted-foreground'}`}>
                    {plan.cadence}
                  </span>
                </div>
                <ul className="mt-5 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-[13px]">
                      <Check className={`h-3.5 w-3.5 ${plan.featured ? 'text-primary' : 'text-success'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.featured ? 'secondary' : 'outline'}
                  className={`mt-auto h-10 w-full ${plan.featured ? 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover' : ''}`}
                >
                  <a href={`mailto:comercial@tcs.app?subject=${encodeURIComponent(`Interesse no plano ${plan.name}`)}`}>
                    {plan.action}
                  </a>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="seguranca" className="bg-foreground text-background">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-12 xl:gap-12 xl:px-16 xl:py-[46px]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Segurança por padrão</p>
            <h2 className="mt-4 max-w-[550px] text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] sm:text-[36px]">
              Confiança não é um recurso extra.
            </h2>
            <p className="mt-5 max-w-[570px] text-[15px] leading-6 text-background/60">
              Proteção da identidade ao histórico de cada decisão, com controles pensados para operações públicas e equipes distribuídas.
            </p>
            <Button asChild variant="secondary" className="mt-8 h-[46px] bg-primary text-primary-foreground hover:bg-primary-hover">
              <a href="mailto:seguranca@tcs.app">Conhecer segurança</a>
            </Button>
          </div>

          <div>
            <div className="rounded-lg border border-background/15 bg-background/5 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-background/45">Postura de segurança</p>
                  <p className="mt-2 text-[13px] text-background/55">
                    Monitoramento contínuo · políticas válidas · nenhum segredo exposto
                  </p>
                </div>
                <p className="shrink-0 text-[28px] font-bold text-primary">98/100</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {securityItems.map((item) => {
                const SecurityIcon = item.icon;
                return (
                  <article key={item.title} className="min-h-[194px] rounded-lg border border-background/15 bg-background/5 p-5">
                    <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-md bg-primary">
                      <SecurityIcon className="h-5 w-5 text-primary-foreground" strokeWidth={1.8} />
                    </span>
                    <h3 className="mt-6 text-[15px] font-semibold">{item.title}</h3>
                    <p className="mt-2 text-[12px] leading-[1.55] text-background/55">{item.text}</p>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-background/40">Controles alinhados à LGPD e às práticas de segurança para software como serviço.</p>
          </div>
        </div>
      </section>

      <section id="contato" className="scroll-mt-20 bg-muted">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16 xl:py-[72px]">
          <Eyebrow>Contato</Eyebrow>
          <h2 className="mt-3 max-w-[760px] text-[30px] font-semibold leading-[1.2] tracking-[-0.02em] sm:text-[34px]">
            Fale direto com a equipe certa.
          </h2>
          <p className="mt-4 max-w-[720px] text-[15px] leading-6 text-muted-foreground">
            Escolha o assunto para receber orientação comercial, suporte operacional ou atendimento especializado.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ContactCard title="Contratar o TCS" text="Planos, demonstração e liberação inicial." email="comercial@tcs.app" />
            <ContactCard title="Suporte" text="Acesso, uso do app e dúvidas operacionais." email="suporte@tcs.app" />
            <ContactCard title="Privacidade e LGPD" text="Dados pessoais, consentimento e seus direitos." email="privacidade@tcs.app" />
            <ContactCard title="Segurança" text="Incidentes, controles e comunicações responsáveis." email="seguranca@tcs.app" />
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-[1440px] px-4 py-9 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid gap-8 rounded-lg bg-foreground px-6 py-8 text-background sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Planos para cada escala</p>
              <h2 className="mt-3 text-[26px] font-semibold leading-[1.2] sm:text-[30px]">
                Comece pequeno. Evolua sem trocar de plataforma.
              </h2>
              <p className="mt-3 text-[13px] text-background/55">
                Planos individuais e municipais, com limites, recursos e SLA transparentes.
              </p>
              <div className="mt-6 grid gap-4 text-[13px] sm:grid-cols-3">
                <PlanSummary label="Individual" value={`a partir de ${marketingPrice(individualPlan?.monthlyPriceCents)}`} />
                <PlanSummary label="Municipal" value={`a partir de ${marketingPrice(municipalPlan?.monthlyPriceCents)}`} />
                <PlanSummary label="Enterprise" value="sob consulta" />
              </div>
            </div>
            <Button asChild variant="secondary" className="h-[46px] bg-primary px-6 text-primary-foreground hover:bg-primary-hover">
              <a href="#planos">Comparar planos</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductPreview() {
  return (
    <div
      aria-label="Prévia da operação municipal"
      className="grid min-h-[360px] overflow-hidden rounded-lg border bg-card sm:min-h-[416px] sm:grid-cols-[132px_1fr]"
    >
      <aside className="hidden bg-foreground px-4 py-5 text-background sm:block">
        <div className="flex items-center gap-2">
          <TcsMark decorative size={28} />
          <span className="text-[11px] font-semibold">TCS</span>
        </div>
        <div className="mt-8 space-y-3">
          {[true, false, false, false].map((active, index) => (
            <div key={index} className={`h-8 rounded-md ${active ? 'bg-background/10' : 'bg-transparent'}`}>
              <span className={`ml-3 mt-3 inline-block h-1.5 rounded-full ${active ? 'w-12 bg-primary' : 'w-9 bg-background/15'}`} />
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Painel ao vivo</p>
            <h2 className="mt-1 text-[18px] font-semibold">Operação municipal</h2>
          </div>
          <Badge variant="success">Operando</Badge>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <PreviewMetric value="248" label="Vistorias" />
          <PreviewMetric value="12" label="Pendências" />
          <PreviewMetric value="8" label="Equipes" />
        </div>

        <div className="relative mt-5 h-[210px] overflow-hidden rounded-lg border bg-secondary">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(hsl(var(--primary)/.09)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/.09)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute left-[8%] top-[58%] h-px w-[88%] -rotate-[12deg] bg-primary/25" />
          <div className="absolute left-[26%] top-[10%] h-[90%] w-px rotate-[18deg] bg-primary/20" />
          <MapDot className="left-[18%] top-[58%]" />
          <MapDot className="left-[42%] top-[34%]" />
          <MapDot className="left-[63%] top-[62%]" emphasized />
          <MapDot className="left-[80%] top-[28%]" />
          <div className="absolute bottom-3 left-3 rounded-md bg-card/90 px-3 py-2 text-[10px] font-semibold text-muted-foreground ">
            Cobertura territorial · 84%
          </div>
        </div>
      </div>
    </div>
  );
}

function MapDot({ className, emphasized = false }: { className: string; emphasized?: boolean }) {
  return (
    <span
      className={`absolute h-3 w-3 rounded-full border-2 border-card  ${
        emphasized ? 'bg-success' : 'bg-primary'
      } ${className}`}
    />
  );
}

function PreviewMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{children}</p>;
}

function PlanSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-[11px] text-background/45">{value}</p>
    </div>
  );
}

function ContactCard({ title, text, email }: { title: string; text: string; email: string }) {
  return (
    <article className="flex min-h-[190px] flex-col rounded-lg border bg-card p-6 ">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{text}</p>
      <a className="mt-auto inline-flex items-center gap-2 pt-5 text-[13px] font-semibold text-primary" href={`mailto:${email}`}>
        {email} <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}
