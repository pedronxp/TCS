/* eslint-disable react-refresh/only-export-components */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-w-0 items-center justify-center gap-2 whitespace-normal rounded-xl text-center text-sm font-medium transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-b from-primary to-primary-hover text-primary-foreground hover:brightness-110 shadow-sm shadow-primary/20',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm shadow-destructive/20',
        outline:
          'border border-border/80 bg-card/80 backdrop-blur-sm text-foreground hover:bg-secondary hover:border-primary/40 shadow-xs',
        secondary: 'bg-secondary/90 text-secondary-foreground hover:bg-secondary',
        ghost: 'text-foreground hover:bg-secondary/80',
        info: 'bg-info text-info-foreground hover:bg-info/90 shadow-sm shadow-info/20',
        link: 'h-auto text-primary underline-offset-4 hover:underline px-0 min-h-0',
      },
      size: {
        default: 'min-h-10 px-4 py-2',
        sm: 'min-h-9 rounded-lg px-3 py-1.5 text-[13px]',
        lg: 'min-h-11 rounded-xl px-8 py-2.5 text-base',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
