import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AsyncEmpty, AsyncError, AsyncLoading } from '@/components/states/AsyncBoundary';
import { StatusBadge as DomainStatusBadge } from '@/components/domain/Badges';
import { Alert, AlertDescription, AlertTitle } from './Alert';
import { Table, TableBody, TableHead, TableHeader, TableRow } from './Table';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) { return <AsyncLoading label={label} />; }
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) { return <AsyncError error={error} onRetry={onRetry} />; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <AsyncEmpty title={title} description={description} action={action} />; }
export function StatusBadge({ value }: { value: string | null }) { return <DomainStatusBadge value={value} />; }

export function SuccessState({ title, description }: { title: string; description?: string }) {
  return <Alert variant="success" role="status"><CheckCircle2 className="h-4 w-4" /><AlertTitle>{title}</AlertTitle>{description && <AlertDescription>{description}</AlertDescription>}</Alert>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Filtros">{children}</div>;
}

export function DataTable({ headers, children, minWidth = 760 }: { headers: string[]; children: ReactNode; minWidth?: number }) {
  return <div className="rounded-xl border bg-card"><Table style={{ minWidth }}><TableHeader><TableRow>{headers.map((header) => <TableHead key={header} scope="col">{header}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div>;
}
