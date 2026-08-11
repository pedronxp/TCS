import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

export function AsyncBoundary({ loading, error, empty, onRetry, loadingLabel = 'Carregando dados…', emptyTitle = 'Nenhum resultado', emptyDescription = 'Não há dados para os filtros selecionados.', children }: { loading: boolean; error?: unknown; empty?: boolean; onRetry?: () => void; loadingLabel?: string; emptyTitle?: string; emptyDescription?: string; children: ReactNode }) {
  if (loading) return <AsyncLoading label={loadingLabel} />;
  if (error) return <AsyncError error={error} onRetry={onRetry} />;
  if (empty) return <AsyncEmpty title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}

export function AsyncLoading({ label = 'Carregando dados…', rows = 3 }: { label?: string; rows?: number }) {
  return <div className="space-y-3 rounded-lg border border-border bg-card p-5" aria-busy="true" aria-live="polite"><span className="sr-only">{label}</span><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{label}</div>{Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
}

export function AsyncError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados.';
  return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Falha ao carregar</AlertTitle><AlertDescription><p>{message}</p>{onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}><RefreshCw />Tentar novamente</Button>}</AlertDescription></Alert>;
}

export function AsyncEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground"><Inbox className="h-5 w-5" /></span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}
