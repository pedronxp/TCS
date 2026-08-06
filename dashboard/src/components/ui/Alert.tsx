import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-md border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground', { variants: { variant: { default: 'bg-background text-foreground', destructive: 'border-destructive/40 bg-destructive-soft text-destructive [&>svg]:text-destructive', warning: 'border-warning/40 bg-warning-soft text-warning-foreground', success: 'border-success/35 bg-success-soft text-success' } }, defaultVariants: { variant: 'default' } });
export const Alert = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(({ className, variant, ...props }, ref) => <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />);
Alert.displayName = 'Alert';
export const AlertTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />);
AlertTitle.displayName = 'AlertTitle';
export const AlertDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />);
AlertDescription.displayName = 'AlertDescription';
