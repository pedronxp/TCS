/* eslint-disable react-refresh/only-export-components */
import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FormField({ id, label, description, error, required, children }: { id: string; label: string; description?: string; error?: string; required?: boolean; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-semibold">{label}{required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}</label>{children}{description && <p id={`${id}-description`} className="text-xs text-muted-foreground">{description}</p>}{error && <p id={`${id}-error`} className="text-xs font-medium text-destructive" role="alert">{error}</p>}</div>;
}

export const FieldError = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <p ref={ref} role="alert" className={cn('text-xs font-medium text-destructive', className)} {...props} />);
FieldError.displayName = 'FieldError';

export function fieldA11yProps(id: string, options: { error?: string; description?: string }): InputHTMLAttributes<HTMLInputElement> {
  const describedBy = [options.description ? `${id}-description` : null, options.error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return { id, 'aria-invalid': Boolean(options.error), 'aria-describedby': describedBy };
}
