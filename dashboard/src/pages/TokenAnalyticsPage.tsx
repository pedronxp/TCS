import { BarChart3, KeyRound, RefreshCw, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { BrazilMunicipalityPicker, BrazilStateSelect } from '@/components/BrazilMunicipalityPicker';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useState } from 'react';
import { useTokenAnalytics } from '@/hooks/useTokenAnalytics';

export function TokenAnalyticsPage() {
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const query = useTokenAnalytics(municipio, uf);
  const data = query.data;
  return <section className="page-stack max-w-[1180px]">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Segurança operacional</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">Análise de tokens</h1><p className="mt-1 text-sm text-muted-foreground">Totais e padrões de emissão, sem revelar códigos de convite.</p></div><Button asChild variant="outline"><Link to="/app/tokens"><KeyRound />Voltar aos tokens</Link></Button></header>
    <Card><CardContent className="flex flex-wrap items-center gap-2 p-4"><BrazilStateSelect value={uf} onValueChange={(value) => { setUf(value); setMunicipio(''); }} includeAll /><BrazilMunicipalityPicker uf={uf} value={municipio} onValueChange={setMunicipio} includeAll allValue="" allLabel="Todos os municípios" placeholder="Filtrar município" className="w-56" /><Button size="icon" variant="outline" aria-label="Atualizar análise" onClick={() => void query.refetch()}><RefreshCw className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} /></Button></CardContent></Card>
    {query.isLoading ? <AnalyticsSkeleton /> : query.isError || !data ? <Card><CardContent className="p-6 text-sm text-destructive">Não foi possível carregar a análise. Atualize a página ou tente novamente.</CardContent></Card> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total emitido" value={data.summary.total} /><Metric label="Ativos" value={data.summary.active} /><Metric label="Utilizados" value={data.summary.used} /><Metric label="Expirados" value={data.summary.expired} /><Metric label="Revogados" value={data.summary.revoked} /></section>
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Emissões nos últimos 14 dias</CardTitle></CardHeader><CardContent><div className="h-72" role="img" aria-label="Gráfico de emissões de tokens nos últimos 14 dias"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.daily}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip labelFormatter={(value) => new Date(`${String(value)}T00:00:00`).toLocaleDateString('pt-BR')} formatter={(value) => [value, 'Tokens']} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Quem mais emitiu</CardTitle></CardHeader><CardContent className="space-y-3">{data.creators.length ? data.creators.map((creator, index) => <div key={`${creator.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{creator.name}</p><p className="text-xs text-muted-foreground">{creator.active} ativo(s) · {creator.used} usado(s)</p></div><strong className="text-lg tabular-nums">{creator.total}</strong></div>) : <p className="text-sm text-muted-foreground">Ainda não há emissões neste recorte.</p>}</CardContent></Card></section>
      <Card><CardHeader><CardTitle>Perfis contemplados</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3">{data.roles.length ? data.roles.map((role) => <div key={role.role} className="rounded-lg border px-4 py-3 text-sm"><span className="text-muted-foreground">{role.role}</span><strong className="ml-3 tabular-nums">{role.count}</strong></div>) : <p className="text-sm text-muted-foreground">Ainda não há dados para exibir.</p>}</CardContent></Card>
    </>}
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString('pt-BR')}</p></CardContent></Card>; }
function AnalyticsSkeleton() { return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><Skeleton className="h-80" /></div>; }
