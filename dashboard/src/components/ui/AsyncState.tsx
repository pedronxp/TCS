import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return <div className="grid min-h-48 place-items-center text-sm text-slate-500" aria-live="polite"><div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{label}</div></div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados.';
  return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert"><div className="flex gap-3"><AlertCircle className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Falha ao carregar</p><p className="mt-1 text-sm">{message}</p>{onRetry && <button onClick={onRetry} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Tentar novamente</button>}</div></div></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><Inbox className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}

export function StatusBadge({ value }: { value: string | null }) {
  const label = value ?? 'sem status';
  const positive = ['active', 'trial', 'pilot', 'resolved', 'executed'].includes(label);
  const danger = ['suspended', 'past_due', 'critical', 'failed', 'error'].includes(label);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${danger ? 'bg-red-50 text-red-700' : positive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{label}</span>;
}

export function SuccessState({ title, description }: { title: string; description?: string }) {
  return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800" role="status"><div className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0" /><div><p className="font-semibold">{title}</p>{description && <p className="mt-1 text-sm">{description}</p>}</div></div></div>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Filtros">{children}</div>;
}

export function DataTable({ headers, children, minWidth = 760 }: { headers: string[]; children: ReactNode; minWidth?: number }) {
  return <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm" style={{ minWidth }}><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} scope="col" className="p-3">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
