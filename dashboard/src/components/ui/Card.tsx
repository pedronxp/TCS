import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('min-w-0 rounded-lg border bg-card text-card-foreground shadow-card', className)} {...props} />);
Card.displayName = 'Card';
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('flex min-w-0 flex-col flex-wrap space-y-1.5 p-6', className)} {...props} />);
CardHeader.displayName = 'CardHeader';
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => <h2 ref={ref} className={cn('min-w-0 text-[22px] font-semibold leading-[1.4]', className)} {...props} />);
CardTitle.displayName = 'CardTitle';
export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />);
CardDescription.displayName = 'CardDescription';
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('min-w-0 p-6 pt-0', className)} {...props} />);
CardContent.displayName = 'CardContent';
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn('flex min-w-0 flex-wrap items-center p-6 pt-0', className)} {...props} />);
CardFooter.displayName = 'CardFooter';
