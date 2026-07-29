import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}><div className="min-w-0">{eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-info">{eyebrow}</p>}<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</header>;
}
