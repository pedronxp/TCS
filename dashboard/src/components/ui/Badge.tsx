/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex min-h-7 min-w-0 items-center rounded-full border px-3 py-1.5 text-[11px] font-bold leading-none transition-colors focus:outline-none focus:ring-[3px] focus:ring-ring/20', {
  variants: {
    variant: {
      default: 'border-border bg-secondary text-foreground',
      secondary: 'border-border bg-secondary text-foreground',
      destructive: 'border-destructive/25 bg-status-danger text-foreground',
      success: 'border-success/25 bg-status-success text-foreground',
      warning: 'border-warning/25 bg-status-warning text-foreground',
      info: 'border-info/25 bg-info-soft text-foreground',
      outline: 'border-border bg-card text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <div className={cn(badgeVariants({ variant }), className)} {...props} />; }
export { badgeVariants };
