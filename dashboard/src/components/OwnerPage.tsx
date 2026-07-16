import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function OwnerPage({ title, description, loading, error, actions, children }: { title: string; description: string; loading?: boolean; error?: string | null; actions?: ReactNode; children: ReactNode }) {
  return <div>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="text-sm text-muted-foreground mt-1">{description}</p></div>{actions}</div>
    {loading ? <div className="py-16 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div> : error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : children}
  </div>;
}

export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}
