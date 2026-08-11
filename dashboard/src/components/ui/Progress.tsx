import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

export const Progress = forwardRef<ElementRef<typeof ProgressPrimitive.Root>, ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>>(({ className, value, ...props }, ref) => <ProgressPrimitive.Root ref={ref} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)} {...props}><ProgressPrimitive.Indicator className="h-full w-full flex-1 bg-primary transition-transform duration-200 [transition-timing-function:var(--motion-ease-in-out)] motion-reduce:transition-none" style={{ transform: `translateX(-${100 - (value || 0)}%)` }} /></ProgressPrimitive.Root>);
Progress.displayName = ProgressPrimitive.Root.displayName;
