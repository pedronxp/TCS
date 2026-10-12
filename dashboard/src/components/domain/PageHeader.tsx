import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Cabeçalho de página 2.0:
// - marcador esmeralda + eyebrow em verde (retorno ao design aprovado)
// - título maior, bold e tracking apertado
// - descrição em cinza muted
// - ações à direita
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-success">
            <span aria-hidden="true" className="h-px w-4 rounded-full bg-success" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[2rem] sm:leading-[1.15]">{title}</h1>
        {description && (
          <p className="mt-2.5 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
