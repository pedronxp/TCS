import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { cn } from '@/lib/utils';

const positives = new Set(['active', 'trial', 'trialing', 'pilot', 'resolved', 'executed', 'completed', 'concluida', 'healthy', 'published', 'publicado', 'restored']);
const dangers = new Set(['suspended', 'past_due', 'critical', 'failed', 'error', 'blocked', 'revoked', 'cancelled', 'archived', 'arquivado']);
const warnings = new Set(['pending', 'warning', 'processing', 'queued', 'draft', 'rascunho', 'archiving', 'restoring']);

export function StatusBadge({ value, fallback = 'Sem status' }: { value: string | null | undefined; fallback?: string }) {
  const normalized = value?.toLowerCase() || '';
  const variant: BadgeProps['variant'] = dangers.has(normalized) ? 'destructive' : positives.has(normalized) ? 'success' : warnings.has(normalized) ? 'warning' : 'secondary';
  return <Badge variant={variant}>{ptBrLabel(value, fallback)}</Badge>;
}

export function RiskBadge({ risk }: { risk: 'R1' | 'R2' | 'R3' | 'R4' | null | undefined }) {
  const descriptions = { R1: 'Baixo', R2: 'Moderado', R3: 'Alto', R4: 'Crítico' } as const;
  if (!risk) return <Badge variant="secondary">Sem classificação</Badge>;
  const classes = { R1: 'border-transparent bg-risk-r1/12 text-risk-r1', R2: 'border-transparent bg-risk-r2/16 text-warning', R3: 'border-transparent bg-risk-r3/14 text-risk-r3', R4: 'border-transparent bg-risk-r4/12 text-risk-r4' };
  return <Badge className={classes[risk]}><span aria-hidden="true">{risk}</span><span className="mx-1" aria-hidden="true">•</span>{descriptions[risk]}</Badge>;
}

export function EnvironmentBadge({ environment }: { environment: string }) {
  const production = environment === 'production';
  return <Badge variant={production ? 'warning' : 'info'}><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{ptBrLabel(environment)}</Badge>;
}

export function RoleBadge({ role, className }: { role: 'owner' | 'developer' | 'support' | 'auditor' | string; className?: string }) {
  const config = getRoleConfig(role);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotClassName)} />
      {config.label}
    </span>
  );
}

/**
 * Identifica o nível de acesso cadastrado para uma conta do aplicativo.
 * Não usa permissões internas do Console, que pertencem à equipe TCS e têm
 * uma semântica diferente das funções de usuários e membros municipais.
 */
export function AccountPermissionBadge({ role, className }: { role: string | null | undefined; className?: string }) {
  const config = getAccountPermissionConfig(role);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={`${config.label}. ${config.description}`}
            className={cn(
              'inline-flex cursor-help items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              config.className,
              className,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', config.dotClassName)} aria-hidden="true" />
            {config.label}
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current/40 text-[10px] leading-none" aria-hidden="true">?</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-center leading-5">
          {config.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getAccountPermissionConfig(role: string | null | undefined) {
  switch (role?.trim().toLowerCase()) {
    case 'master_admin':
    case 'master':
      return {
        label: 'Master',
        description: 'Acesso administrativo máximo cadastrado para esta conta.',
        className: 'border-primary/25 bg-primary/10 text-primary',
        dotClassName: 'bg-primary',
      };
    case 'owner':
    case 'dono':
    case 'organization_owner':
      return {
        label: 'Dono',
        description: 'Responsável pela conta ou organização, com gestão do seu escopo.',
        className: 'border-info/25 bg-info/10 text-info',
        dotClassName: 'bg-info',
      };
    case 'admin':
    case 'administrator':
    case 'coordinator':
      return {
        label: 'Administrador',
        description: 'Conta com permissões administrativas no município ou organização vinculada.',
        className: 'border-warning/25 bg-warning/10 text-warning',
        dotClassName: 'bg-warning',
      };
    case 'supervisor':
      return {
        label: 'Supervisor',
        description: 'Coordena a operação no município ou organização vinculada, sem receber privilégios de dono.',
        className: 'border-info/25 bg-info/10 text-info',
        dotClassName: 'bg-info',
      };
    case 'agent':
    case 'agente':
      return {
        label: 'Agente',
        description: 'Acesso operacional para executar vistorias e atividades autorizadas.',
        className: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
      };
    case 'user':
    case 'usuario':
    case 'usuário':
      return {
        label: 'Usuário comum',
        description: 'Acesso básico, sem administração da conta ou do município.',
        className: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
      };
    default:
      return {
        label: 'Papel não identificado',
        description: 'O papel cadastrado não pertence aos níveis reconhecidos pelo Console e precisa ser revisado.',
        className: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
      };
  }
}

function getRoleConfig(role: string) {
  switch (role) {
    case 'owner':
      return {
        label: 'Owner',
        className: 'border-primary/20 bg-primary/10 text-primary',
        dotClassName: 'bg-primary',
      };
    case 'developer':
      return {
        label: 'Developer',
        className: 'border-info/20 bg-info/10 text-info',
        dotClassName: 'bg-info',
      };
    case 'support':
      return {
        label: 'Suporte',
        className: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
      };
    case 'auditor':
      return {
        label: 'Auditor',
        className: 'border-warning/20 bg-warning/10 text-warning',
        dotClassName: 'bg-warning',
      };
    default:
      return {
        label: role,
        className: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
      };
  }
}

export function CustomerKindBadge({ kind, className }: { kind: 'individual' | 'organization' | string; className?: string }) {
  const config = getKindConfig(kind);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

function getKindConfig(kind: string) {
  switch (kind) {
    case 'individual':
      return {
        label: 'Individual',
        className: 'border-border bg-muted text-muted-foreground',
      };
    case 'organization':
      return {
        label: 'Municipal',
        className: 'border-primary/20 bg-primary/10 text-primary',
      };
    default:
      return {
        label: kind,
        className: 'border-border bg-muted text-muted-foreground',
      };
  }
}
