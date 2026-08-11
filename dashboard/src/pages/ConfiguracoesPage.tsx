import {
  Archive,
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  ExternalLink,
  FileClock,
  Hammer,
  Info,
  KeyRound,
  ServerCog,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/domain/PageHeader';
import { EnvironmentBadge } from '@/components/domain/Badges';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const projectRef = supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;

const integrations = [
  {
    label: 'EAS Build',
    description: 'Geração remota dos artefatos do aplicativo.',
    variables: ['EAS_TOKEN', 'EAS_PROJECT_ID'],
    link: 'https://expo.dev',
    Icon: Hammer,
  },
  {
    label: 'GitHub Actions',
    description: 'Pipeline alternativo de build e entrega.',
    variables: ['GH_ACTIONS_TOKEN', 'GITHUB_REPO'],
    link: 'https://github.com/settings/tokens',
    Icon: Code2,
  },
  {
    label: 'Google Drive',
    description: 'Retenção externa e restauração auditável de laudos e fotos.',
    variables: ['GOOGLE_SERVICE_ACCOUNT_KEY', 'DRIVE_FOLDER_ROOT_ID'],
    link: 'https://console.cloud.google.com',
    Icon: Cloud,
  },
] as const;

export function ConfiguracoesPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Governança"
        title="Configurações"
        description="Visão operacional do ambiente, integrações e contratos usados pelo console interno."
        actions={<EnvironmentBadge environment={import.meta.env.PROD ? 'production' : 'development'} />}
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Configuração informativa nesta onda</AlertTitle>
        <AlertDescription>
          Ainda não existe contrato server-side para preparar ou publicar um conjunto genérico de mudanças.
          Por segurança, esta tela não simula edições nem grava segredos no navegador.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]" aria-label="Estado do sistema">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ServerCog className="h-5 w-5" />Sistema</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <SystemItem label="Aplicativo" value="TCS — Relatório de Risco" />
            <SystemItem label="Console web" value="0.1.0" />
            <SystemItem label="Projeto Supabase" value={projectRef || 'Referência não disponível'} mono />
            <SystemItem label="Fonte de configuração" value="Variáveis do ambiente" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5" />Mudanças pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed p-5 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-success" />
              <p className="mt-3 font-semibold">Nenhum conjunto genérico publicável</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                O estado permanece somente leitura até existir versionamento, revisão e rollback no backend.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="configuration-shortcuts">
        <h2 id="configuration-shortcuts" className="mb-3 text-lg font-bold">Operações relacionadas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <OperationLink
            to="/app/governanca/arquivamento"
            title="Arquivamento e retenção"
            description="Lifecycle Storage → Drive e fila segura de restauração."
            Icon={Archive}
          />
          <OperationLink
            to="/app/desenvolvimento/builds"
            title="Builds e entregas"
            description="Artefatos, provedores e aprovação de produção."
            Icon={Hammer}
          />
        </div>
      </section>

      <section aria-labelledby="external-integrations">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="external-integrations" className="text-lg font-bold">Integrações externas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nomes necessários; valores nunca são retornados ao cliente.</p>
          </div>
          <Badge variant="outline">Status não exposto ao cliente</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {integrations.map(({ label, description, variables, link, Icon }) => (
            <Card key={label}>
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{label}</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                <div className="flex flex-wrap gap-2" aria-label={`Variáveis de ${label}`}>
                  {variables.map((variable) => <Badge key={variable} variant="outline" className="font-mono">{variable}</Badge>)}
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-4 px-0">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    Abrir provedor <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-accent p-2 text-accent-foreground"><Database className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold">Administração do banco</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Alterações de schema passam por migrations; segredos são administrados fora do console.
              </p>
            </div>
          </div>
          {projectRef ? (
            <Button asChild variant="outline">
              <a href={`https://supabase.com/dashboard/project/${projectRef}/editor`} target="_blank" rel="noopener noreferrer">
                <KeyRound className="h-4 w-4" />Abrir Studio
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled title="A referência do projeto não está disponível neste ambiente">
              <KeyRound className="h-4 w-4" />Studio indisponível
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SystemItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function OperationLink({
  to,
  title,
  description,
  Icon,
}: {
  to: string;
  title: string;
  description: string;
  Icon: typeof Archive;
}) {
  return (
    <Link to={to} className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent p-2 text-accent-foreground"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="font-semibold group-hover:text-primary">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}
