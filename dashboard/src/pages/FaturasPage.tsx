import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Plus, RotateCw, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type InvoiceStatus = 'aberta' | 'em_analise' | 'paga' | 'vencida' | 'cancelada';

interface InvoiceRow {
  id: string;
  organization_id: string;
  competencia: string;
  valor_centavos: number;
  vencimento: string;
  status: InvoiceStatus;
  comprovante_path: string | null;
  comprovante_enviado_em: string | null;
  pago_em: string | null;
  motivo_rejeicao: string | null;
  criado_em: string;
  organizations: { display_name: string } | null;
}

interface NoticeRule {
  id: string;
  dias_offset: number;
  titulo: string;
  corpo: string;
  ativo: boolean;
}

interface BillingSettings {
  tolerancia_dias: number;
  fatura_antecedencia_dias: number;
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  aberta: 'Aguardando pagamento',
  em_analise: 'Comprovante em análise',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

const STATUS_VARIANT: Record<InvoiceStatus, 'warning' | 'info' | 'success' | 'destructive' | 'secondary'> = {
  aberta: 'warning',
  em_analise: 'info',
  paga: 'success',
  vencida: 'destructive',
  cancelada: 'secondary',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (centavos: number) => BRL.format(centavos / 100);
const fmtData = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

// ─── Página ──────────────────────────────────────────────────────────────────

export function FaturasPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rejecting, setRejecting] = useState<InvoiceRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [ruleEditing, setRuleEditing] = useState<NoticeRule | 'new' | null>(null);
  const [settings, setSettings] = useState<BillingSettings>({ tolerancia_dias: 5, fatura_antecedencia_dias: 7 });
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const faturas = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('id,organization_id,competencia,valor_centavos,vencimento,status,comprovante_path,comprovante_enviado_em,pago_em,motivo_rejeicao,criado_em,organizations(display_name)')
        .order('vencimento', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });

  const regras = useQuery({
    queryKey: ['billing-notice-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_notice_rules')
        .select('id,dias_offset,titulo,corpo,ativo')
        .order('dias_offset', { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoticeRule[];
    },
  });

  const configQuery = useQuery({
    queryKey: ['billing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_settings')
        .select('tolerancia_dias,fatura_antecedencia_dias')
        .single();
      if (error) throw error;
      return data as BillingSettings;
    },
  });

  useEffect(() => {
    if (configQuery.data && typeof configQuery.data === 'object' && !Array.isArray(configQuery.data)) {
      setSettings((prev) => ({ ...prev, ...configQuery.data }));
    }
  }, [configQuery.data]);

  // ── Mutations ──

  const aprovar = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.rpc('approve_invoice_payment', { p_invoice_id: invoiceId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pagamento aprovado — período renovado.');
      void queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
    },
    onError: (e) => toast.error(`Falha ao aprovar: ${e.message}`),
  });

  const rejeitar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase.rpc('reject_invoice_receipt', { p_invoice_id: id, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Comprovante rejeitado e cliente notificado na próxima abertura da fatura.');
      setRejecting(null);
      setRejectReason('');
      void queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
    },
    onError: (e) => toast.error(`Falha ao rejeitar: ${e.message}`),
  });

  const rodarMotor = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('run_billing_engine_now');
      if (error) throw error;
      return data as Record<string, number>;
    },
    onSuccess: (r) => {
      toast.success(`Motor executado: ${r.faturas_criadas} criada(s), ${r.faturas_vencidas} vencida(s), ${r.avisos_enviados} aviso(s).`);
      void queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
    },
    onError: (e) => toast.error(`Motor falhou: ${e.message}`),
  });

  const salvarRegra = useMutation({
    mutationFn: async (regra: Partial<NoticeRule> & { id?: string }) => {
      if (regra.id) {
        const { error } = await supabase
          .from('billing_notice_rules')
          .update({ dias_offset: regra.dias_offset, titulo: regra.titulo, corpo: regra.corpo, ativo: regra.ativo, atualizado_em: new Date().toISOString() })
          .eq('id', regra.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('billing_notice_rules')
          .insert({ dias_offset: regra.dias_offset ?? 7, titulo: regra.titulo ?? '', corpo: regra.corpo ?? '' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Regra de aviso salva.');
      setRuleEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['billing-notice-rules'] });
    },
    onError: (e) => toast.error(`Falha ao salvar regra: ${e.message}`),
  });

  const excluirRegra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('billing_notice_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regra removida.');
      void queryClient.invalidateQueries({ queryKey: ['billing-notice-rules'] });
    },
    onError: (e) => toast.error(`Falha ao remover: ${e.message}`),
  });

  const salvarConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('billing_settings')
        .update({ ...settings, atualizado_em: new Date().toISOString() })
        .eq('singleton', true);
      if (error) throw error;
    },
    onSuccess: () => toast.success('Configurações salvas.'),
    onError: (e) => toast.error(`Falha ao salvar: ${e.message}`),
  });

  // ── Preview do comprovante ──

  const abrirComprovante = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível abrir o comprovante.');
      return;
    }
    setReceiptUrl(data.signedUrl);
  };

  const filtradas = useMemo(() => {
    const lista = faturas.data ?? [];
    return statusFilter === 'all' ? lista : lista.filter(f => f.status === statusFilter);
  }, [faturas.data, statusFilter]);

  const emAnalise = (faturas.data ?? []).filter(f => f.status === 'em_analise');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faturas</h1>
          <p className="text-sm text-muted-foreground">Cobrança manual: comprovantes, avisos e tolerância.</p>
        </div>
        <Button variant="outline" onClick={() => rodarMotor.mutate()} disabled={rodarMotor.isPending}>
          <RotateCw className={`mr-2 h-4 w-4 ${rodarMotor.isPending ? 'animate-spin' : ''}`} />
          Rodar motor agora
        </Button>
      </div>

      {/* Fila de comprovantes pendentes de análise */}
      {emAnalise.length > 0 && (
        <Card className="border-warning/40 bg-warning-soft/30">
          <CardHeader>
            <h2 className="text-base font-semibold">Comprovantes aguardando sua análise ({emAnalise.length})</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {emAnalise.map(f => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{f.organizations?.display_name ?? f.organization_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.competencia} · {fmt(f.valor_centavos)} · venc. {fmtData(f.vencimento)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void abrirComprovante(f.comprovante_path)}>
                  <FileText className="mr-1 h-4 w-4" /> Ver comprovante
                </Button>
                <Button size="sm" onClick={() => aprovar.mutate(f.id)} disabled={aprovar.isPending}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { setRejecting(f); setRejectReason(''); }}>
                  <XCircle className="mr-1 h-4 w-4" /> Rejeitar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lista geral de faturas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Todas as faturas</h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 min-w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map(s => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Organização</th>
                <th className="px-4 py-2">Competência</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Vencimento</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Comprovante</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(f => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{f.organizations?.display_name ?? '—'}</td>
                  <td className="px-4 py-2">{f.competencia}</td>
                  <td className="px-4 py-2">{fmt(f.valor_centavos)}</td>
                  <td className="px-4 py-2">{fmtData(f.vencimento)}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[f.status]}>{STATUS_LABEL[f.status]}</Badge></td>
                  <td className="px-4 py-2">
                    {f.comprovante_path ? (
                      <Button size="sm" variant="ghost" onClick={() => void abrirComprovante(f.comprovante_path)}>Abrir</Button>
                    ) : '—'}
                    {f.motivo_rejeicao ? <p className="mt-1 text-xs text-destructive">Rejeitado: {f.motivo_rejeicao}</p> : null}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhuma fatura nesse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Regras de aviso */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Avisos de vencimento</h2>
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {'{org} {vencimento} {dias_restantes} {valor} {plano}'}
            </p>
          </div>
          <Button size="sm" onClick={() => setRuleEditing('new')}><Plus className="mr-1 h-4 w-4" /> Nova regra</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(regras.data ?? []).map(r => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-28">
                <p className="text-sm font-semibold">
                  {r.dias_offset > 0 ? `${r.dias_offset}d antes` : r.dias_offset === 0 ? 'No dia' : `${Math.abs(r.dias_offset)}d depois`}
                </p>
                <Badge variant={r.ativo ? 'success' : 'secondary'}>{r.ativo ? 'Ativa' : 'Inativa'}</Badge>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{r.titulo}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{r.corpo}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setRuleEditing(r)}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => excluirRegra.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {(regras.data ?? []).length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nenhuma regra ainda. Crie a primeira para começar os lembretes.</p>
          )}
        </CardContent>
      </Card>

      {/* Configurações */}
      <Card>
        <CardHeader><h2 className="text-base font-semibold">Configurações de cobrança</h2></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="tolerancia">Tolerância (dias após vencimento)</Label>
            <Input id="tolerancia" type="number" min={0} max={60} className="w-32"
              value={settings.tolerancia_dias}
              onChange={e => setSettings(s => ({ ...s, tolerancia_dias: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="antecedencia">Fatura aparece (dias antes)</Label>
            <Input id="antecedencia" type="number" min={1} max={30} className="w-32"
              value={settings.fatura_antecedencia_dias}
              onChange={e => setSettings(s => ({ ...s, fatura_antecedencia_dias: Number(e.target.value) }))} />
          </div>
          <Button onClick={() => salvarConfig.mutate()} disabled={salvarConfig.isPending}>Salvar configurações</Button>
        </CardContent>
      </Card>

      {/* Dialog rejeição */}
      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar comprovante</DialogTitle>
            <DialogDescription>
              {rejecting ? `${rejecting.organizations?.display_name ?? ''} · ${rejecting.competencia} · ${fmt(rejecting.valor_centavos)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="motivo">Motivo (visível para o cliente no app)</Label>
            <Textarea id="motivo" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Ex.: comprovante ilegível ou valor divergente" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || rejeitar.isPending}
              onClick={() => rejecting && rejeitar.mutate({ id: rejecting.id, motivo: rejectReason.trim() })}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog regra de aviso */}
      <RuleEditor
        regra={ruleEditing}
        onClose={() => setRuleEditing(null)}
        onSave={(r) => salvarRegra.mutate(r)}
        saving={salvarRegra.isPending}
      />

      {/* Preview comprovante */}
      <Dialog open={!!receiptUrl} onOpenChange={(open) => { if (!open) setReceiptUrl(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Comprovante</DialogTitle></DialogHeader>
          {receiptUrl?.toLowerCase().includes('.pdf') ? (
            <iframe src={receiptUrl} title="Comprovante PDF" className="h-[70vh] w-full rounded" />
          ) : receiptUrl ? (
            <img src={receiptUrl} alt="Comprovante de pagamento" className="max-h-[70vh] w-full rounded object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Editor de regra ─────────────────────────────────────────────────────────

function RuleEditor({ regra, onClose, onSave, saving }: {
  regra: NoticeRule | 'new' | null;
  onClose: () => void;
  onSave: (r: Partial<NoticeRule> & { id?: string }) => void;
  saving: boolean;
}) {
  const isNew = regra === 'new';
  const base = isNew ? null : regra;
  const [form, setForm] = useState({ dias_offset: 7, titulo: '', corpo: '', ativo: true });

  useEffect(() => {
    setForm(base
      ? { dias_offset: base.dias_offset, titulo: base.titulo, corpo: base.corpo, ativo: base.ativo }
      : { dias_offset: 7, titulo: '', corpo: '', ativo: true });
  }, [base]);

  return (
    <Dialog open={!!regra} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nova regra de aviso' : 'Editar regra'}</DialogTitle>
          <DialogDescription>
            Positivo = dias antes do vencimento · 0 = no dia · negativo = depois do vencimento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="offset">Disparo (dias em relação ao vencimento)</Label>
            <Input id="offset" type="number" className="w-32" value={form.dias_offset}
              onChange={e => setForm(f => ({ ...f, dias_offset: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Sua fatura vence em {dias_restantes} dias" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="corpo">Mensagem</Label>
            <Textarea id="corpo" rows={4} value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))}
              placeholder="Olá! A fatura de {org} ({valor}) vence em {vencimento}. Pague via PIX e anexe o comprovante no app." />
          </div>
          {!isNew && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
              Regra ativa
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving || form.titulo.trim().length < 3 || form.corpo.trim().length < 3}
            onClick={() => onSave(isNew ? form : { id: (base as NoticeRule).id, ...form })}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FaturasPage;
