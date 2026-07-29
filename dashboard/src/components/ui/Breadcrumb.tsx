import { Fragment, type ComponentPropsWithoutRef, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

const Breadcrumb = ({ ...props }: ComponentPropsWithoutRef<'nav'>) => <nav aria-label="Trilha de navegação" {...props} />;
const BreadcrumbList = ({ className, ...props }: ComponentPropsWithoutRef<'ol'>) => <ol className={cn('flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5', className)} {...props} />;
const BreadcrumbItem = ({ className, ...props }: ComponentPropsWithoutRef<'li'>) => <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />;
const BreadcrumbLink = ({ asChild, className, ...props }: ComponentPropsWithoutRef<'a'> & { asChild?: boolean }) => { const Comp = asChild ? Slot : 'a'; return <Comp className={cn('transition-colors hover:text-foreground', className)} {...props} />; };
const BreadcrumbPage = ({ className, ...props }: ComponentPropsWithoutRef<'span'>) => <span role="link" aria-disabled="true" aria-current="page" className={cn('font-medium text-foreground', className)} {...props} />;
const BreadcrumbSeparator = ({ children, className, ...props }: ComponentPropsWithoutRef<'li'>) => <li role="presentation" aria-hidden="true" className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)} {...props}>{children ?? <ChevronRight />}</li>;
const BreadcrumbEllipsis = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => <span role="presentation" aria-hidden="true" className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Mais</span></span>;

export function BreadcrumbTrail({ items }: { items: Array<{ label: string; href?: string; node?: ReactNode }> }) {
  return <Breadcrumb><BreadcrumbList>{items.map((item, index) => <Fragment key={`${item.label}-${index}`}><BreadcrumbItem>{item.node ?? (item.href ? <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink> : <BreadcrumbPage>{item.label}</BreadcrumbPage>)}</BreadcrumbItem>{index < items.length - 1 && <BreadcrumbSeparator />}</Fragment>)}</BreadcrumbList></Breadcrumb>;
}
export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis };
