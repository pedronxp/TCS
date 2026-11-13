import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Bot,
  Check,
  ClipboardCheck,
  FileCheck2,
  Map,
  NotebookPen,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TcsMark } from '@/components/brand/TcsMark';
import { AppExperienceShowcase } from '@/components/public/AppExperienceShowcase';
import { supabase, supabaseConfigurationAvailable } from '@/lib/supabase';

interface PublicMarketingSnapshot {
  total_vistorias: number;
  pendencias: number;
  agentes: number;
  latest_protocols: Array<{ protocolo: string; risco: string }>;
  updated_at: string;
}

const workflow = [
  { title: 'Registre no campo', text: 'Reúna formulário, localização e evidências na mesma vistoria — mesmo sem sinal.', icon: NotebookPen },
  { title: 'Acompanhe no mapa', text: 'Veja protocolos, pendências e o contexto territorial da operação.', icon: Map },
  { title: 'Entregue o registro', text: 'Organize laudos, relatórios e o histórico usado na tomada de decisão.', icon: ClipboardCheck },
] as const;

// Funções reais do sistema, uma a uma — nada de promessa que o produto não entrega.
const capabilities = [
  { title: 'Vistoria com protocolo oficial', text: 'Cada registro recebe série municipal única no formato TCS-CIDADE-AAAA-SEQUENCIAL, auditável de ponta a ponta.', icon: ClipboardCheck },
  { title: 'Classificação de risco R1–R4', text: 'Cálculo por pontuação e pesos do formulário, com conduta recomendada por nível e revisão de qualidade (QE) antes do laudo.', icon: ShieldCheck },
  { title: 'Laudo, relatório e termo', text: 'PDFs gerados a partir da própria vistoria, com ciência eletrônica do responsável por assinatura ou link.', icon: FileCheck2 },
  { title: 'Offline-first', text: 'A vistoria começa sem sinal: dados ficam no aparelho e sincronizam sozinhos quando a rede volta.', icon: WifiOff },
  { title: 'Mapa tático', text: 'Protocolos georreferenciados por risco, período e tipo de formulário — com heatmap e rota até o local.', icon: Map },
  { title: 'Agenda e avisos', text: 'Tarefas atribuídas a agentes e campanhas de aviso por severidade, entregues in-app e por push.', icon: BellRing },
  { title: 'Bot WhatsApp com IA', text: 'O agente busca vistorias, baixa laudos e responde pela operação — com rollout gradual por organização.', icon: Bot },
  { title: 'Console e portal', text: 'Gestão interna (clientes, assinaturas, suporte, auditoria) e portal próprio para prefeituras e profissionais.', icon: Users },
] as const;

const securityControls = [
  'Isolamento por organização com Row Level Security no banco',
  'MFA obrigatório em ações sensíveis, como rotação de séries de protocolo',
  'Trilha de auditoria completa e exportável, por pessoa e resultado',
  'Sessões e dispositivos gerenciados pelo console',
  'LGPD: nenhum CPF em tela, modelo ou banco',
] as const;

export function CommercialPage() {
  return (
    <div className="overflow-x-clip">
      <section id="produto" className="bg-background">
        <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-11 sm:px-8 lg:px-12 xl:px-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] lg:items-center lg:gap-10">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Sistema de vistoria técnica de risco</p>
              <h1 className="mt-4 max-w-[650px] text-[36px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[44px] xl:text-[52px]">
                Registre a vistoria uma vez. Use a evidência até a decisão.
              </h1>
              <p className="mt-6 max-w-[610px] text-base leading-7 text-muted-foreground">
                O TCS conecta o trabalho em campo ao acompanhamento da operação: protocolo oficial, risco classificado,
                laudo com ciência eletrônica e gestão em um só lugar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-[46px] px-5"><Link to="/login">Entrar no console</Link></Button>
                <Button asChild variant="outline" className="h-[46px] px-5"><Link to="/entrar">Portal do cliente</Link></Button>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">Acesso para contas TCS — organizações entram por convite de token.</p>
            </div>
            <ProductPreview />
          </div>
        </div>
      </section>

      <section id="funcoes" className="bg-card">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Como funciona</p>
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

      <section id="recursos" className="bg-background">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Funções do sistema</p>
          <h2 className="mt-3 max-w-[760px] text-3xl font-semibold tracking-[-0.02em]">Tudo que a operação usa, todos os dias.</h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="flex flex-col rounded-lg border bg-card p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-success-soft" aria-hidden="true"><Icon className="h-5 w-5 text-success" /></span>
                  <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <AppExperienceShowcase />

      <section id="seguranca" className="bg-foreground text-background">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-start lg:px-12 xl:px-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Segurança e governança</p>
            <h2 className="mt-3 max-w-[650px] text-3xl font-semibold tracking-[-0.02em]">Controles reais, auditáveis a qualquer momento.</h2>
            <p className="mt-4 max-w-[700px] text-sm leading-6 text-background/65">
              Estes são os controles ativos no sistema hoje — os mesmos que o console e o portal usam internamente.
            </p>
          </div>
          <ul className="space-y-3">
            {securityControls.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-background/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="acesso" className="scroll-mt-20 bg-background">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Acesso</p>
          <h2 className="mt-3 max-w-[760px] text-3xl font-semibold tracking-[-0.02em]">Duas portas, um mesmo sistema.</h2>
          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <AccessCard
              title="Console TCS"
              description="Área da equipe TCS: carteira de clientes, assinaturas, suporte, protocolos, IA e auditoria da operação."
              action="Ir para o console"
              href="/login"
            />
            <AccessCard
              title="Portal do cliente"
              description="Para prefeituras, órgãos e profissionais: vistorias, mapa, documentos, equipe e assinatura da organização."
              action="Ir para o portal"
              href="/entrar"
            />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Privacidade: <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:privacidade@tcs.app">privacidade@tcs.app</a></p>
        </div>
      </section>
    </div>
  );
}

function AccessCard({ title, description, action, href }: { title: string; description: string; action: string; href: string }) {
  return (
    <article className="flex min-h-[240px] flex-col rounded-lg border bg-card p-6">
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-auto w-full">
        <Link to={href}>{action}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
      </Button>
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
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Prévia da operação</p><h2 className="mt-1 text-lg font-semibold">Operação em números</h2></div><Badge variant="info">{badgeLabel}</Badge></div>
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
