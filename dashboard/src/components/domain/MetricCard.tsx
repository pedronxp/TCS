import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

// MetricCard minimalista: card flat (sem sombra), ícone em chip neutro,
// número grande, trend em verde/vermelho semântico.
export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: number;
  hint?: string;
  className?: string;
}) {
  const up = typeof trend === 'number' && trend >= 0;
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {Icon && (
            <span className="rounded-lg bg-muted p-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
        {(typeof trend === 'number' || hint) && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {typeof trend === 'number' && (
              <span
                className={cn(
                  'inline-flex items-center font-semibold',
                  up ? 'text-primary' : 'text-destructive'
                )}
              >
                {up ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {Math.abs(trend)}%
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
