import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { BrazilMunicipalityPicker, BrazilStateSelect } from '@/components/BrazilMunicipalityPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { supabase } from '@/lib/supabase';

type Platform = 'android' | 'ios' | 'web';
type CampaignStatus = 'queued' | 'processing' | 'completed' | 'partial' | 'failed' | 'no_recipients';
type Campaign = { id: string; title: string; category: string; priority: string; municipio: string | null; target_platforms: string[]; target_roles: string[]; status: CampaignStatus; recipient_count: number; sent_count: number; failed_count: number; skipped_count?: number; failure_reason?: string | null; created_at: string; completed_at: string | null };
type Draft = { title: string; body: string; category: 'operational' | 'security' | 'token' | 'maintenance'; priority: 'normal' | 'high'; municipio: string; uf: string; platforms: Platform[] };

const platformLabels: Record<Platform, string> = { android: 'Android', ios: 'iOS', web: 'Web' };
const statusLabels: Record<CampaignStatus, string> = { queued: 'Na fila', processing: 'Enviando', completed: 'Concluída', partial: 'Parcial', failed: 'Falhou', no_recipients: 'Sem destinatários' };
const statusDescriptions: Record<CampaignStatus, string> = {
  queued: 'Aguardando o processador iniciar a entrega.',
  processing: 'O processador está enviando aos dispositivos elegíveis.',
  completed: 'Todas as tentativas elegíveis foram concluídas.',
  partial: 'Parte da audiência não recebeu; consulte o motivo.',
  failed: 'O processamento não pôde ser concluído.',
  no_recipients: 'Não havia dispositivo ativo, aprovado e compatível com o público e plataforma escolhidos.',
};

export function NotificationCampaignsPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const campaigns = useQuery({
    queryKey: ['notification-campaigns'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (fn: string, args?: Record<string, never>) => PromiseLike<{ data: Campaign[] | null; error: { message: string } | null }>)('list_notification_campaigns');
      if (error) throw error;
      return data ?? [];
    },
  });
  const create = useAdministrativeMutation<{ draft: Draft; reason: string }, unknown>({
    mutationFn: async ({ draft: nextDraft, reason }, operationId) => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)('create_notification_campaign', {
        p_title: nextDraft.title.trim(), p_body: nextDraft.body.trim(), p_category: nextDraft.category, p_priority: nextDraft.priority,
        p_municipio: nextDraft.municipio === 'all' ? null : nextDraft.municipio, p_platforms: nextDraft.platforms, p_roles: [], p_payload: {}, p_reason: reason, p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['notification-campaigns'], ['audit-timeline']],
  });
  const rows = useMemo(() => (campaigns.data ?? []).filter((campaign) => statusFilter === 'all' || campaign.status === statusFilter), [campaigns.data, statusFilter]);
  return <section className="page-stack max-w-[1094px]">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Comunicação operacional</p><h1 className="mt-2 text-[30px] font-bold tracking-[-0.035em]">Avisos e notificações</h1><p className="mt-1 text-sm text-muted-foreground">Envie campanhas segmentadas por município e plataforma, com entrega rastreável.</p></div><Button onClick={() => setDraft({ title: '', body: '', category: 'operational', priority: 'normal', municipio: 'all', uf: '', platforms: ['android', 'ios'] })}><Plus />Novo aviso</Button></div>
    <Alert><BellRing className="h-4 w-4" /><AlertDescription>Android e iOS usam Expo Push. Web sempre registra o aviso na central interna dos usuários elegíveis; o pop-up do navegador também exige permissão, VAPID e service worker.</AlertDescription></Alert>
    {dispatchError && <Alert variant="destructive"><AlertDescription>{dispatchError}</AlertDescription></Alert>}
    <Card><CardHeader className="flex-row flex-wrap items-end justify-between gap-4 space-y-0"><div><CardTitle>Campanhas</CardTitle><p className="mt-1 text-sm text-muted-foreground">Status e resultado de cada disparo.</p></div><div className="flex gap-2"><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | CampaignStatus)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" aria-label="Atualizar campanhas" onClick={() => void campaigns.refetch()}><RefreshCw className={campaigns.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} /></Button></div></CardHeader><CardContent><StatusLegend />{campaigns.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando campanhas…</p> : campaigns.isError ? <p className="text-sm text-destructive">Não foi possível carregar as campanhas.</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-3">Aviso</th><th className="p-3">Público</th><th className="p-3">Plataformas</th><th className="p-3">Entrega</th><th className="p-3">Status</th></tr></thead><tbody>{rows.map((campaign) => <tr key={campaign.id} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{campaign.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(campaign.created_at)}</p></td><td className="p-3">{campaign.municipio || 'Todos os municípios'}</td><td className="p-3">{campaign.target_platforms.map((platform) => platformLabels[platform as Platform] ?? platform).join(', ')}</td><td className="p-3"><DeliverySummary campaign={campaign} /></td><td className="p-3"><Status value={campaign.status} reason={campaign.failure_reason} /></td></tr>)}</tbody></table></div>}</CardContent></Card>
    <CampaignDialog draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onContinue={() => setConfirming(true)} />
    {draft && <HighRiskDialog open={confirming} title="Confirmar envio de aviso" description="A audiência será calculada no servidor por município e plataforma. O envio e cada tentativa de entrega ficarão registrados." confirmLabel="Agendar envio" onClose={() => setConfirming(false)} onConfirm={async (reason) => { const result = await create.mutateAsync({ draft, reason }) as { ok?: boolean; error?: string; recipient_count?: number }; if (!result.ok) throw new Error(result.error); if (result.recipient_count === 0) setDispatchError('Não há usuários aprovados no público selecionado. Revise o município, os perfis e as plataformas.'); else { const { error } = await supabase.functions.invoke('dispatch-notification-campaigns', { body: {} }); setDispatchError(error ? 'O aviso foi criado, mas a entrega complementar por Push não pôde iniciar. A central interna continua disponível.' : null); } await campaigns.refetch(); setConfirming(false); setDraft(null); }} />}
  </section>;
}

function CampaignDialog({ draft, onChange, onClose, onContinue }: { draft: Draft | null; onChange: (draft: Draft) => void; onClose: () => void; onContinue: () => void }) {
  if (!draft) return null;
  const toggle = (platform: Platform, checked: boolean) => onChange({ ...draft, platforms: checked ? [...draft.platforms, platform] : draft.platforms.filter((value) => value !== platform) });
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Novo aviso</DialogTitle><DialogDescription>Escolha precisamente quem deve receber a comunicação.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="campaign-title">Título</Label><Input id="campaign-title" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="campaign-body">Mensagem</Label><Textarea id="campaign-body" rows={4} value={draft.body} onChange={(event) => onChange({ ...draft, body: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Categoria</Label><Select value={draft.category} onValueChange={(category) => onChange({ ...draft, category: category as Draft['category'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="operational">Operacional</SelectItem><SelectItem value="security">Segurança</SelectItem><SelectItem value="token">Token</SelectItem><SelectItem value="maintenance">Manutenção</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Prioridade</Label><Select value={draft.priority} onValueChange={(priority) => onChange({ ...draft, priority: priority as Draft['priority'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Estado</Label><BrazilStateSelect value={draft.uf} onValueChange={(uf) => onChange({ ...draft, uf, municipio: uf ? '' : 'all' })} includeAll /></div><div className="space-y-2"><Label>Município</Label><BrazilMunicipalityPicker uf={draft.uf} value={draft.municipio} onValueChange={(municipio) => onChange({ ...draft, municipio })} /></div><fieldset className="space-y-2"><legend className="text-sm font-medium">Plataformas</legend><div className="flex flex-wrap gap-4">{(Object.keys(platformLabels) as Platform[]).map((platform) => <Label key={platform} className="flex items-center gap-2 font-normal"><Checkbox checked={draft.platforms.includes(platform)} onCheckedChange={(checked) => toggle(platform, checked === true)} />{platformLabels[platform]}</Label>)}</div></fieldset></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!draft.title.trim() || !draft.body.trim() || !draft.platforms.length} onClick={onContinue}>Revisar envio</Button></DialogFooter></DialogContent></Dialog>;
}

function DeliverySummary({ campaign }: { campaign: Campaign }) { if (campaign.recipient_count === 0) return <p className="text-sm font-medium">Sem destinatários elegíveis</p>; return <><p>{campaign.sent_count}/{campaign.recipient_count} enviados{campaign.failed_count ? ` · ${campaign.failed_count} falharam` : ''}{campaign.skipped_count ? ` · ${campaign.skipped_count} não entregues` : ''}</p>{campaign.failure_reason === 'web_push_not_configured' && <p className="mt-1 text-xs text-muted-foreground">Web Push ainda não configurado.</p>}</>; }
function Status({ value, reason }: { value: CampaignStatus; reason?: string | null }) { const tone: Record<CampaignStatus, string> = { queued: 'bg-info-soft', processing: 'bg-warning-soft', completed: 'bg-success-soft', partial: 'bg-warning-soft', failed: 'bg-destructive-soft text-destructive', no_recipients: 'bg-muted text-muted-foreground' }; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone[value]}`} title={reason === 'no_eligible_recipients' ? statusDescriptions.no_recipients : statusDescriptions[value]}>{statusLabels[value]}</span>; }
function StatusLegend() { return <details className="mb-4 rounded-xl border border-border/80 bg-secondary/35 px-4 py-3"><summary className="cursor-pointer text-sm font-semibold">O que significa cada status?</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(statusLabels) as CampaignStatus[]).map((status) => <div key={status}><dt><Status value={status} /></dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">{statusDescriptions[status]}</dd></div>)}</dl></details>; }
function formatDate(value: string) { return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
