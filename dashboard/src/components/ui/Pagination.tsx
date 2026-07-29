import type { ComponentProps } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

const Pagination = ({ className, ...props }: ComponentProps<'nav'>) => <nav role="navigation" aria-label="paginação" className={cn('mx-auto flex w-full justify-center', className)} {...props} />;
const PaginationContent = ({ className, ...props }: ComponentProps<'ul'>) => <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />;
const PaginationItem = ({ className, ...props }: ComponentProps<'li'>) => <li className={cn(className)} {...props} />;
type PaginationLinkProps = { isActive?: boolean } & ComponentProps<'a'>;
const PaginationLink = ({ className, isActive, ...props }: PaginationLinkProps) => <a aria-current={isActive ? 'page' : undefined} className={cn('inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium', isActive ? 'border bg-background shadow-sm' : 'hover:bg-accent', className)} {...props} />;
const PaginationPrevious = ({ className, ...props }: ComponentProps<typeof PaginationLink>) => <PaginationLink aria-label="Ir para a página anterior" className={cn('gap-1 pl-2.5', className)} {...props}><ChevronLeft className="h-4 w-4" /><span>Anterior</span></PaginationLink>;
const PaginationNext = ({ className, ...props }: ComponentProps<typeof PaginationLink>) => <PaginationLink aria-label="Ir para a próxima página" className={cn('gap-1 pr-2.5', className)} {...props}><span>Próxima</span><ChevronRight className="h-4 w-4" /></PaginationLink>;
const PaginationEllipsis = ({ className, ...props }: ComponentProps<'span'>) => <span aria-hidden className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Mais páginas</span></span>;

export function PaginationControls({ page, pageCount, onPageChange, busy }: { page: number; pageCount: number; onPageChange: (page: number) => void; busy?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Página {page} de {Math.max(pageCount, 1)}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft />Anterior</Button><Button variant="outline" size="sm" disabled={busy || page >= pageCount} onClick={() => onPageChange(page + 1)}>Próxima<ChevronRight /></Button></div></div>;
}
export { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis };
