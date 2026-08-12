import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-input/80 bg-card/90 px-3.5 py-2 text-sm shadow-sm transition-all duration-200',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground/70',
        'hover:border-primary/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:bg-card',
        'disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:text-muted-foreground disabled:opacity-75',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
