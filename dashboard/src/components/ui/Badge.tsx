/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Badge minimalista: pílula monocromática com fundo soft e texto semântico.
// 2.0: variantes semânticas (success/warning/destructive/info) ganham ponto de
// status à esquerda; variantes neutras (default/secondary/outline) ficam limpas
// para não poluir contadores e rótulos informativos.
const badgeVariants = cva(
  'inline-flex min-h-6 min-w-0 items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-medium leading-none backdrop-blur-xs transition-all focus:outline-none focus:ring-2 focus:ring-ring/30',
  {
    variants: {
      variant: {
        default: 'border-border/60 bg-secondary/80 text-foreground',
        secondary: 'border-border/60 bg-secondary/80 text-foreground',
        destructive:
          'border-destructive/25 bg-destructive-soft text-destructive',
        success: 'border-success/25 bg-success-soft text-foreground',
        warning: 'border-warning/25 bg-warning-soft text-warning-foreground',
        info: 'border-info/25 bg-info-soft text-info',
        outline: 'border-border/80 bg-card/60 text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const STATUS_DOT_VARIANTS = new Set(['destructive', 'success', 'warning', 'info']);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, children, ...props }: BadgeProps) {
  const withDot = variant != null && STATUS_DOT_VARIANTS.has(variant);
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {withDot && (
        <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      )}
      {children}
    </div>
  );
}
export { badgeVariants };
