import { Building2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';

export function CustomerContextBar({ customerId, name, status, detail }: { customerId: string; name: string; status?: string | null; detail?: string }) {
  return (
    <aside className="sticky top-[84px] z-20 flex flex-col gap-3 rounded-lg border bg-card/95 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center" aria-label="Contexto persistente do cliente">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="rounded-lg bg-accent p-2 text-accent-foreground"><Building2 className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
      {status && <Badge variant="secondary">{status}</Badge>}
      <Link to={`/app/clientes/${encodeURIComponent(customerId)}/resumo`} className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Abrir resumo de ${name}`}>
        Resumo do cliente <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
