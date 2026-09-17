import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink, Eye, FileCheck2, Image, Printer, ShieldAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabase';
import { buildLaudoHtml, buildTermoInterdicaoHtml, type LaudoData } from '../../../utils/laudoPdfBuilder';

type WorkspaceKind = 'laudo' | 'relatorio' | 'termo' | 'fotos';
type Inspection = {
  id: string; protocol: string; risk: string | null; score: number | null; occurredAt: string | null;
  municipality: string | null; organization: string | null; responsible: string | null; address: string | null;
  canViewSensitive: boolean; documents: { laudo: boolean; report: boolean; term: boolean }; photoCount: number;
  formId: string | null; agentName: string | null; answers: unknown; riskSnapshot: unknown; photoUrls: string[];
};
type AuthorizedResource = { url: string; filename: string };

const titles: Record<WorkspaceKind, string> = { laudo: 'Laudo técnico', relatorio: 'Relatório de vistoria', termo: 'Termo de interdição', fotos: 'Fotos registradas' };

export function ProtocolDocumentWorkspacePage({ kind }: { kind: WorkspaceKind }) {
  const { inspectionId } = useParams();
  const query = useQuery({
    queryKey: ['protocol-document-workspace', inspectionId],
    enabled: Boolean(inspectionId),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>)('get_internal_protocol_inspection', { p_inspection_id: inspectionId });
      const inspection = parseInspection(data);
      if (error || !inspection) throw new Error(error?.message ?? 'vistoria_indisponivel');
      return inspection;
    },
  });

  return <section className="page-stack mx-auto w-full max-w-[980px]">
    <header>
      <Button asChild variant="ghost" className="-ml-3"><Link to={inspectionId ? `/app/protocolos/${inspectionId}` : '/app/protocolos'}><ArrowLeft />Voltar à vistoria</Link></Button>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-primary">Documento operacional</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">{titles[kind]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{query.data ? `${query.data.protocol} · ${query.data.organization ?? query.data.municipality ?? 'Origem não informada'}` : 'Carregando dados da vistoria…'}</p>
    </header>
    <AsyncBoundary loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} loadingLabel="Carregando documento…">
      {query.data && <DocumentWorkspace kind={kind} inspection={query.data} onUpdated={() => void query.refetch()} />}
    </AsyncBoundary>
  </section>;
}

function DocumentWorkspace({ kind, inspection, onUpdated }: { kind: WorkspaceKind; inspection: Inspection; onUpdated: () => void }) {
  const [resources, setResources] = useState<AuthorizedResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [term, setTerm] = useState({ name: '', cpf: '', street: '', number: '', complement: '', district: '', city: inspection.municipality ?? '', phone: '' });
  const available = kind === 'laudo' ? inspection.documents.laudo : kind === 'relatorio' ? inspection.documents.report : kind === 'termo' ? inspection.documents.term : inspection.photoCount > 0;
  const viewResource = async (mode: 'view' | 'download' = 'view') => {
    const resourceKind = kind === 'fotos' ? 'photo' : 'laudo';
    setLoading(true); setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('internal-protocol-resource', { body: { inspection_id: inspection.id, kind: resourceKind, mode } });
      const parsed = parseResources(data, resourceKind);
      if (error || !parsed.length) throw new Error('resource_not_authorized');
      setResources(parsed);
      if (kind === 'laudo' && parsed[0]) window.open(parsed[0].url, '_blank', 'noopener,noreferrer');
    } catch { setMessage('Não foi possível autorizar este arquivo. Verifique o acesso sensível e tente novamente.'); }
    finally { setLoading(false); }
  };
  const laudoData = (): LaudoData => ({
    id: inspection.id,
    protocolo: inspection.protocol,
    nivelRisco: inspection.risk ?? 'r1',
    pontuacaoTotal: inspection.score ?? 0,
    endereco: inspection.address ?? '',
    municipio: inspection.municipality ?? inspection.organization ?? '',
    dataVistoria: inspection.occurredAt,
    agenteNome: inspection.agentName ?? inspection.responsible ?? '',
    responsavelNome: inspection.responsible ?? undefined,
    formularioId: inspection.formId ?? undefined,
    respostasJson: typeof inspection.answers === 'string'
      ? inspection.answers
      : JSON.stringify(inspection.answers ?? {}),
    calculoRisco: (inspection.riskSnapshot ?? null) as LaudoData['calculoRisco'],
    observacoesTecnicas: reportNotes,
    fotosUrls: inspection.photoUrls,
    foto_url: inspection.photoUrls[0] ?? null,
  });

  const print = async (type: 'relatorio' | 'termo') => {
    if (type === 'termo' && !inspection.canViewSensitive) { setMessage('O Termo exige acesso a dados sensíveis da vistoria.'); return; }
    if (type === 'termo' && !term.name.trim()) { setMessage('Informe o nome do notificado para gerar o Termo.'); return; }
    // Não usar 'noopener' aqui: ele faz window.open retornar null nos navegadores
    // modernos e impede o document.write, deixando a aba travada em about:blank.
    const popup = window.open('', '_blank');
    if (!popup) { setMessage('O navegador bloqueou a nova janela. Libere pop-ups para gerar o PDF.'); return; }
    popup.opener = null;
    popup.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando documento…</title></head><body><p style="font-family:sans-serif;padding:32px">Gerando documento oficial da vistoria…</p></body></html>');
    popup.document.close();
    setLoading(true); setMessage(null);
    // Mesmo gerador oficial do app (utils/laudoPdfBuilder), para o documento ser idêntico.
    let html: string;
    try {
      html = type === 'relatorio'
        ? await buildLaudoHtml(laudoData())
        : buildTermoInterdicaoHtml(laudoData(), {
          nomeNotificado: term.name, cpfNotificado: term.cpf, enderecoRua: term.street,
          enderecoNumero: term.number, complemento: term.complement, bairro: term.district,
          cidade: term.city, telefone: term.phone,
        });
    } catch {
      popup.close(); setLoading(false);
      setMessage('Não foi possível montar o documento. Tente novamente.');
      return;
    }
    popup.document.open();
    popup.document.write(html); popup.document.close(); popup.focus();
    setTimeout(() => popup.print(), 500);
    setLoading(false);
    try {
      const { error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ error: Error | null }>)('mark_inspection_document_generated', { p_inspection_id: inspection.id, p_document_type: type });
      if (error) throw error;
      setMessage(`${titles[type]} aberto para impressão e emissão registrada.`); onUpdated();
    } catch { setMessage('O documento foi aberto para impressão, mas a emissão não pôde ser registrada nesta conta.'); }
  };

  if (kind === 'laudo') return <DocumentCard title="Laudo técnico oficial" available={available} description="Documento oficial gerado pela vistoria. Os links são temporários e preservam o acesso sensível."><div className="flex flex-wrap gap-2"><Button disabled={!available || loading} onClick={() => void viewResource('view')}><Eye />{loading ? 'Autorizando…' : 'Ver laudo'}</Button><Button disabled={!available || loading} variant="outline" onClick={() => void viewResource('download')}><Download />Baixar PDF</Button></div>{resources[0] && <a className="mt-4 inline-flex text-sm font-medium text-primary underline" href={resources[0].url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Abrir link autorizado</a>}{message && <Message text={message} />}</DocumentCard>;
  if (kind === 'fotos') return <DocumentCard title="Evidências fotográficas" available={available} description="Fotos acessadas por links temporários; elas não ficam públicas no Console."><Button disabled={!available || loading} onClick={() => void viewResource()}><Image />{loading ? 'Abrindo…' : 'Visualizar fotos'}</Button>{resources.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{resources.map((item, index) => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border bg-muted"><img src={item.url} alt={`Foto registrada ${index + 1}`} className="h-60 w-full object-cover" /><span className="flex items-center gap-2 p-3 text-sm font-medium">Foto {index + 1}<ExternalLink className="h-4 w-4" /></span></a>)}</div>}{message && <Message text={message} />}</DocumentCard>;
  if (kind === 'relatorio') return <DocumentCard title="Gerar e editar relatório" available={available} description="Revise a observação técnica antes de imprimir ou salvar o relatório em PDF. A edição é aplicada somente à emissão atual."><div className="grid gap-5 lg:grid-cols-[1fr_.9fr]"><div className="space-y-2"><Label htmlFor="report-notes">Observação técnica complementar</Label><Textarea id="report-notes" rows={10} value={reportNotes} onChange={(event) => setReportNotes(event.target.value)} placeholder="Registre observações que devem constar nesta emissão…" /><p className="text-xs leading-5 text-muted-foreground">Os dados-base da vistoria permanecem imutáveis. Para alterar respostas da vistoria, utilize o fluxo operacional de correção.</p></div><DocumentFacts inspection={inspection} /></div><Button className="mt-5" onClick={() => void print('relatorio')}><Printer />Gerar relatório / salvar PDF</Button>{message && <Message text={message} />}</DocumentCard>;
  const mayGenerateTerm = ['r3', 'r4'].includes((inspection.risk ?? '').toLowerCase());
  return <DocumentCard title="Gerar Termo de Interdição" available={available || mayGenerateTerm} description={mayGenerateTerm ? 'Preencha os dados do notificado e gere o termo no padrão operacional.' : 'O Termo de Interdição só pode ser emitido para vistorias classificadas como R3 ou R4.'}>{mayGenerateTerm && <><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do notificado" value={term.name} onChange={(name) => setTerm({ ...term, name })} /><Field label="CPF" value={term.cpf} onChange={(cpf) => setTerm({ ...term, cpf })} /><Field label="Rua" value={term.street} onChange={(street) => setTerm({ ...term, street })} /><Field label="Número" value={term.number} onChange={(number) => setTerm({ ...term, number })} /><Field label="Complemento" value={term.complement} onChange={(complement) => setTerm({ ...term, complement })} /><Field label="Bairro" value={term.district} onChange={(district) => setTerm({ ...term, district })} /><Field label="Cidade" value={term.city} onChange={(city) => setTerm({ ...term, city })} /><Field label="Telefone" value={term.phone} onChange={(phone) => setTerm({ ...term, phone })} /></div><Button className="mt-5" disabled={!inspection.canViewSensitive} onClick={() => void print('termo')}><Printer />Gerar Termo / salvar PDF</Button></>}{message && <Message text={message} />}</DocumentCard>;
}

function DocumentCard({ title, available, description, children }: { title: string; available: boolean; description: string; children: ReactNode }) { return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />{title}</CardTitle><Badge variant={available ? 'success' : 'secondary'}>{available ? 'Disponível' : 'Não gerado'}</Badge></div><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardHeader><CardContent>{children}</CardContent></Card>; }
function DocumentFacts({ inspection }: { inspection: Inspection }) { return <div className="rounded-xl border bg-muted/30 p-4"><p className="text-sm font-semibold">Dados que constarão no documento</p><dl className="mt-4 space-y-3 text-sm"><Fact label="Protocolo" value={inspection.protocol} /><Fact label="Risco" value={inspection.risk?.toUpperCase() ?? 'Não informado'} /><Fact label="Responsável" value={inspection.responsible ?? 'Não informado'} /><Fact label="Data" value={formatDate(inspection.occurredAt)} /></dl></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const id = useMemo(() => `term-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`, [label]); return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function Message({ text }: { text: string }) { return <Alert className="mt-5"><ShieldAlert className="h-4 w-4" /><AlertTitle>Emissão</AlertTitle><AlertDescription>{text}</AlertDescription></Alert>; }

function parseInspection(value: unknown): Inspection | null { if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const row = value as Record<string, unknown>; const documents = row.documents && typeof row.documents === 'object' && !Array.isArray(row.documents) ? row.documents as Record<string, unknown> : null; if (typeof row.id !== 'string' || typeof row.protocol !== 'string' || !documents) return null; const photoUrls = Array.isArray(row.photo_urls) ? row.photo_urls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)) : []; return { id: row.id, protocol: row.protocol, risk: stringValue(row.risk_level), score: numberValue(row.score), occurredAt: stringValue(row.occurred_at), municipality: stringValue(row.municipality), organization: stringValue(row.organization), responsible: stringValue(row.responsible_name) ?? stringValue(row.agent_name), address: stringValue(row.address), canViewSensitive: row.can_view_sensitive === true, documents: { laudo: documents.laudo === true, report: documents.report === true, term: documents.term === true }, photoCount: Math.max(0, Math.trunc(numberValue(row.photo_count) ?? 0)), formId: stringValue(row.form_id), agentName: stringValue(row.agent_name), answers: row.answers ?? null, riskSnapshot: row.risk_snapshot ?? null, photoUrls }; }
function parseResources(value: unknown, kind: 'laudo' | 'photo'): AuthorizedResource[] { if (!value || typeof value !== 'object' || Array.isArray(value)) return []; const row = value as Record<string, unknown>; if (row.ok !== true || row.kind !== kind || !Array.isArray(row.resources)) return []; return row.resources.flatMap((item): AuthorizedResource[] => { if (!item || typeof item !== 'object' || Array.isArray(item)) return []; const resource = item as Record<string, unknown>; return typeof resource.url === 'string' && resource.url.startsWith('https://') ? [{ url: resource.url, filename: typeof resource.filename === 'string' ? resource.filename : 'arquivo' }] : []; }); }
function stringValue(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function formatDate(value: string | null) { if (!value) return 'Data não informada'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR'); }
