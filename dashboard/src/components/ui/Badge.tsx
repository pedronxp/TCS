/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-bold leading-none transition-colors focus:outline-none focus:ring-[3px] focus:ring-ring/20', {
  variants: {
    variant: {
      default: 'border-border bg-secondary text-muted-foreground',
      secondary: 'border-border bg-secondary text-muted-foreground',
      destructive: 'border-transparent bg-status-danger text-destructive',
      success: 'border-transparent bg-status-success text-success',
      warning: 'border-transparent bg-status-warning text-warning',
      info: 'border-transparent bg-info-soft text-info',
      outline: 'border-border bg-card text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <div className={cn(badgeVariants({ variant }), className)} {...props} />; }
export { badgeVariants };
