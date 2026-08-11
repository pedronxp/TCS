import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, ClipboardCheck, Map, NotebookPen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TcsMark } from '@/components/brand/TcsMark';
import { AppExperienceShowcase } from '@/components/public/AppExperienceShowcase';
import { formatPublicPlanPrice, getPublicPlansForAudience } from '@/config/publicPlans';
import { supabase, supabaseConfigurationAvailable } from '@/lib/supabase';

interface PublicMarketingSnapshot {
  total_vistorias: number;
  pendencias: number;
  agentes: number;
  latest_protocols: Array<{ protocolo: string; risco: string }>;
  updated_at: string;
}

const individualPlans = getPublicPlansForAudience('individual');
const municipalPlans = getPublicPlansForAudience('municipal');

const workflow = [
  { title: 'Registre no campo', text: 'Reúna formulário, localização e evidências na mesma vistoria.', icon: NotebookPen },
  { title: 'Acompanhe no mapa', text: 'Veja protocolos, pendências e o contexto territorial da operação.', icon: Map },
  { title: 'Entregue o registro', text: 'Organize relatórios e o histórico usado na tomada de decisão.', icon: ClipboardCheck },
] as const;

export function CommercialPage() {
  return (
    <div className="overflow-x-clip">
      <section id="produto" className="bg-background">
        <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-11 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] lg:items-center lg:gap-10">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Vistorias e gestão territorial</p>
              <h1 className="mt-4 max-w-[650px] text-[36px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[44px] xl:text-[52px]">
                Registre a vistoria uma vez. Use a evidência até a decisão.
              </h1>
              <p className="mt-6 max-w-[610px] text-base leading-7 text-muted-foreground">
                O TCS conecta o trabalho em campo ao acompanhamento da operação, com caminhos distintos para profissionais e prefeituras.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-[46px] px-5"><Link to="/planos">Comparar preços e limites</Link></Button>
                <Button asChild variant="outline" className="h-[46px] px-5">
                  <a href="mailto:comercial@tcs.app?subject=Conversa%20sobre%20opera%C3%A7%C3%A3o%20municipal">Conversar sobre operação municipal</a>
                </Button>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">Planos individuais a partir de {formatPublicPlanPrice(individualPlans[0].monthlyPriceCents)}/mês.</p>
            </div>
            <ProductPreview />
          </div>
        </div>
      </section>

      <section id="solucoes" className="bg-card">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Da coleta ao acompanhamento</p>
          <h2 className="mt-3 max-w-[720px] text-3xl font-semibold tracking-[-0.02em]">Três etapas, o mesmo registro.</h2>
          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border bg-background p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary" aria-hidden="true"><Icon className="h-5 w-5 text-primary" /></span>
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <AppExperienceShowcase />

      <section id="planos" className="bg-muted">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Escolha pelo modo de operar</p>
          <h2 className="mt-3 max-w-[760px] text-3xl font-semibold tracking-[-0.02em]">Individual ou Municipal: comece pela comparação certa.</h2>
          <p className="mt-4 max-w-[700px] text-sm leading-6 text-muted-foreground">Os preços e limites abaixo vêm do mesmo catálogo usado na página de planos.</p>
          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <AudienceCard
              title="Individual"
              description="Para quem realiza e entrega as próprias vistorias. Compare pelo volume mensal."
              startPrice={individualPlans[0].monthlyPriceCents}
              facts={[individualPlans[0].limits[0], individualPlans[1].limits[0]]}
              action="Comparar planos individuais"
              href="/planos#individual"
            />
            <AudienceCard
              title="Municipal"
              description="Para prefeituras que coordenam agentes, vistorias e armazenamento."
              startPrice={municipalPlans[0].monthlyPriceCents}
              facts={[municipalPlans[0].limits[0], municipalPlans[0].limits[1]]}
              action="Comparar planos municipais"
              href="/planos#municipal"
            />
          </div>
        </div>
      </section>

      <section id="seguranca" className="bg-foreground text-background">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12 xl:px-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Segurança e privacidade</p>
            <h2 className="mt-3 max-w-[650px] text-3xl font-semibold tracking-[-0.02em]">Avalie os controles antes de colocar a operação em campo.</h2>
            <p className="mt-4 max-w-[700px] text-sm leading-6 text-background/65">Envie os requisitos da sua equipe para uma conversa técnica sobre acesso, dados e privacidade.</p>
          </div>
          <Button asChild variant="secondary" className="h-[46px] bg-primary px-6 text-primary-foreground hover:bg-primary-hover">
            <a href="mailto:seguranca@tcs.app?subject=Avalia%C3%A7%C3%A3o%20de%20seguran%C3%A7a%20do%20TCS">Solicitar conversa técnica</a>
          </Button>
        </div>
      </section>

      <section id="contato" className="scroll-mt-20 bg-background">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Próximo passo</p>
          <h2 className="mt-3 max-w-[760px] text-3xl font-semibold tracking-[-0.02em]">Diga como sua equipe trabalha hoje.</h2>
          <p className="mt-4 max-w-[700px] text-sm leading-6 text-muted-foreground">A equipe comercial responde sobre proposta municipal. Profissionais podem comparar valores e criar a conta pela página de planos.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild><a href="mailto:comercial@tcs.app?subject=Opera%C3%A7%C3%A3o%20atual%20e%20proposta%20TCS">Descrever minha operação</a></Button>
            <Button asChild variant="outline"><Link to="/planos">Ver os cinco planos</Link></Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Privacidade: <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:privacidade@tcs.app">privacidade@tcs.app</a></p>
        </div>
      </section>
    </div>
  );
}

function AudienceCard({ title, description, startPrice, facts, action, href }: { title: string; description: string; startPrice: number; facts: string[]; action: string; href: string }) {
  return (
    <article className="flex min-h-[310px] flex-col rounded-lg border bg-card p-6">
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-5"><span className="text-sm text-muted-foreground">A partir de </span><strong className="text-2xl">{formatPublicPlanPrice(startPrice)}</strong><span className="text-xs text-muted-foreground"> / mês</span></p>
      <ul className="mt-5 space-y-2">
        {facts.map((fact) => <li key={fact} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />{fact}</li>)}
      </ul>
      <Button asChild variant="outline" className="mt-auto w-full"><Link to={href}>{action}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>
    </article>
  );
}

function ProductPreview() {
  const { snapshot, loading } = usePublicMarketingSnapshot();
  const protocols = snapshot?.latest_protocols ?? [];
  const previewState = loading ? 'loading' : snapshot ? 'public' : 'example';
  const badgeLabel = previewState === 'loading' ? 'Consultando' : previewState === 'public' ? 'Dados públicos' : 'Exemplo';
  const statusLabel = previewState === 'loading'
    ? 'Consultando dados públicos…'
    : snapshot
      ? `Atualizado em ${formatSnapshotTimestamp(snapshot.updated_at)}`
      : 'Prévia sem dados de produção';
  return (
    <div aria-label="Prévia da operação municipal" className="grid min-h-[360px] overflow-hidden rounded-lg border bg-card sm:min-h-[416px] sm:grid-cols-[132px_1fr]">
      <aside className="hidden bg-foreground px-4 py-5 text-background sm:block" aria-hidden="true">
        <div className="flex items-center gap-2"><TcsMark decorative size={28} /><span className="text-[11px] font-semibold">TCS</span></div>
        <div className="mt-8 space-y-3">{[true, false, false, false].map((active, index) => <div key={index} className={`h-8 rounded-md ${active ? 'bg-background/10' : ''}`}><span className={`ml-3 mt-3 inline-block h-1.5 rounded-full ${active ? 'w-12 bg-primary' : 'w-9 bg-background/15'}`} /></div>)}</div>
      </aside>
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Prévia do painel</p><h2 className="mt-1 text-lg font-semibold">Operação municipal</h2></div><Badge variant="info">{badgeLabel}</Badge></div>
        <div className="mt-5 grid grid-cols-3 gap-2.5"><PreviewMetric value={formatMetric(snapshot?.total_vistorias, loading)} label="Vistorias" /><PreviewMetric value={formatMetric(snapshot?.pendencias, loading)} label="Pendências" /><PreviewMetric value={formatMetric(snapshot?.agentes, loading)} label="Agentes" /></div>
        <div className="relative mt-5 h-[210px] overflow-hidden rounded-lg border bg-secondary" aria-label="Protocolos recentes de vistoria">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(hsl(var(--primary)/.09)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/.09)_1px,transparent_1px)] [background-size:32px_32px]" />
          <MapDot className="left-[18%] top-[58%]" item={protocols[3]} /><MapDot className="left-[42%] top-[34%]" item={protocols[2]} /><MapDot className="left-[63%] top-[62%]" item={protocols[1]} /><MapDot className="left-[80%] top-[28%]" item={protocols[0]} />
          <div className="absolute bottom-3 left-3 rounded-md bg-card/90 px-3 py-2 text-[10px] font-semibold text-muted-foreground">{statusLabel}</div>
        </div>
      </div>
    </div>
  );
}

function MapDot({ className, item }: { className: string; item?: { protocolo: string; risco: string } }) {
  if (!item) return null;
  const riskColor = item.risco === 'r4' ? 'bg-destructive' : item.risco === 'r3' ? 'bg-warning' : item.risco === 'r2' ? 'bg-primary' : 'bg-success';
  return <span className={`absolute flex flex-col items-center gap-1 ${className}`} aria-label={`Ponto de vistoria ${item.protocolo.toUpperCase()}`}><span className={`h-3 w-3 rounded-full border-2 border-card ${riskColor}`} /><span className="whitespace-nowrap rounded bg-card/95 px-1.5 py-1 text-[8px] font-bold leading-none text-foreground shadow-sm">{item.protocolo.toUpperCase()}</span></span>;
}

function formatMetric(value: number | undefined, loading: boolean) { if (typeof value === 'number') return new Intl.NumberFormat('pt-BR').format(value); return loading ? '…' : '—'; }

function formatSnapshotTimestamp(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'horário não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(timestamp);
}

function usePublicMarketingSnapshot() {
  const [snapshot, setSnapshot] = useState<PublicMarketingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!supabaseConfigurationAvailable) { setLoading(false); return; }
    const { data, error } = await supabase.from('public_marketing_snapshot').select('total_vistorias, pendencias, agentes, latest_protocols, updated_at').eq('id', true).maybeSingle();
    if (!error && data && typeof data === 'object' && !Array.isArray(data)) setSnapshot(data as unknown as PublicMarketingSnapshot);
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh]);
  return { snapshot, loading };
}

function PreviewMetric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-md border bg-background p-3"><p className="text-lg font-bold">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>;
}
