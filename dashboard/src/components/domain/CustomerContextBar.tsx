import { Building2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';

export function CustomerContextBar({ customerId, name, status, detail }: { customerId: string; name: string; status?: string | null; detail?: string }) {
  return <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><span className="rounded-lg bg-accent p-2 text-accent-foreground"><Building2 className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{name}</p>{detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}</div></div>{status && <Badge variant="secondary">{status}</Badge>}<Link to={`/app/clientes/${encodeURIComponent(customerId)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Abrir contexto <ChevronRight className="h-4 w-4" /></Link></div>;
}
