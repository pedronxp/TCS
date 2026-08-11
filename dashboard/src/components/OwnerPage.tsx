import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function OwnerPage({ title, description, loading, error, actions, children }: { title: string; description: string; loading?: boolean; error?: string | null; actions?: ReactNode; children: ReactNode }) {
  return <div>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-foreground">{title}</h1><p className="text-sm text-muted-foreground mt-1">{description}</p></div>{actions}</div>
    {loading ? <div className="py-16 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-primary motion-reduce:animate-none" /></div> : error ? <div className="rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">{error}</div> : children}
  </div>;
}

export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-foreground">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}
