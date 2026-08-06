/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Badge minimalista: pílula monocromática com fundo soft e texto semântico.
// Não usa sombra nem borda colorida pronunciada.
const badgeVariants = cva(
  'inline-flex min-h-6 min-w-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-foreground',
        secondary: 'border-border bg-secondary text-foreground',
        destructive:
          'border-transparent bg-destructive-soft text-destructive',
        success: 'border-transparent bg-success-soft text-primary',
        warning: 'border-transparent bg-warning-soft text-warning',
        info: 'border-transparent bg-info-soft text-info',
        outline: 'border-border bg-card text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { badgeVariants };
