import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { ptBrLabel } from '@/lib/ptBrLabels';

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
