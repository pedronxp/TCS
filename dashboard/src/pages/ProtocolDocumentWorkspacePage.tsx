import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink, Eye, FileCheck2, Image, PenLine, Printer, ShieldAlert } from 'lucide-react';
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
import { BASE_LEGAL_PADRAO, buildLaudoHtml, buildTermoInterdicaoHtml, type LaudoData } from '../../../utils/laudoPdfBuilder';
import type { SignaturePoint, SignatureStroke } from '../../../types/documentAcknowledgement';

type WorkspaceKind = 'laudo' | 'relatorio' | 'termo' | 'fotos';
type Inspection = {
  id: string; protocol: string; risk: string | null; score: number | null; occurredAt: string | null;
  municipality: string | null; organization: string | null; responsible: string | null; address: string | null;
  canViewSensitive: boolean; documents: { laudo: boolean; report: boolean; term: boolean }; photoCount: number;
  formId: string | null; agentName: string | null; requesterName: string | null; answers: unknown; riskSnapshot: unknown; photoUrls: string[];
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
  // Campos editáveis da emissão atual (espelham a tela de relatório do app)
  const [requesterName, setRequesterName] = useState(
    inspection.requesterName
    ?? answerField(inspection.answers, ['Responsável', 'Nome do Responsável', 'Solicitante'])
    ?? '',
  );
  const [techName, setTechName] = useState(inspection.agentName ?? inspection.responsible ?? '');
  const [techRole, setTechRole] = useState('');
  const [baseLegal, setBaseLegal] = useState(BASE_LEGAL_PADRAO);
  const [signature, setSignature] = useState<SignatureStroke[]>([]);
  const [signatureModal, setSignatureModal] = useState<'relatorio' | 'termo' | null>(null);
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
    agenteNome: techName || inspection.agentName || inspection.responsible || '',
    cargo: techRole || undefined,
    responsavelNome: requesterName || undefined,
    formularioId: inspection.formId ?? undefined,
    respostasJson: typeof inspection.answers === 'string'
      ? inspection.answers
      : JSON.stringify(inspection.answers ?? {}),
    calculoRisco: (inspection.riskSnapshot ?? null) as LaudoData['calculoRisco'],
    observacoesTecnicas: reportNotes,
    baseLegal,
    agentSignatureStrokes: signature.length ? signature : null,
    fotosUrls: inspection.photoUrls,
    foto_url: inspection.photoUrls[0] ?? null,
  });

  // Sem assinatura, a geração é bloqueada: o documento precisa da assinatura do agente.
  const requestPrint = (type: 'relatorio' | 'termo') => {
    if (type === 'termo' && !inspection.canViewSensitive) { setMessage('O Termo exige acesso a dados sensíveis da vistoria.'); return; }
    if (type === 'termo' && !term.name.trim()) { setMessage('Informe o nome do notificado para gerar o Termo.'); return; }
    if (signature.length === 0) { setSignatureModal(type); setMessage(null); return; }
    void print(type);
  };

  const print = async (type: 'relatorio' | 'termo') => {
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

  const signatureGateModal = signatureModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-bold">Assinatura obrigatória</h2>
        <p className="mt-1 text-sm text-muted-foreground">O {titles[signatureModal]} ainda não foi assinado. Escolha como deseja assinar antes da emissão.</p>
        <div className="mt-4">
          <Label>Assinar neste computador</Label>
          <SignaturePad strokes={signature} onChange={setSignature} />
        </div>
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-semibold">Prefere assinar no aplicativo?</p>
          <p className="mt-1 text-sm text-muted-foreground">Abra o app TCS, abra a vistoria {inspection.protocol} e gere o documento lá — o app pede a assinatura do agente antes de emitir o PDF.</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => { setSignature([]); setSignatureModal(null); setMessage('Gere o documento no aplicativo TCS para coletar a assinatura do agente.'); }}>Gerar no app (com assinatura)</Button>
          <Button disabled={signature.length === 0} onClick={() => { const type = signatureModal; setSignatureModal(null); void print(type); }}><PenLine />Assinar e gerar {titles[signatureModal].toLowerCase()}</Button>
        </div>
      </div>
    </div>
  );

  if (kind === 'laudo') return <DocumentCard title="Laudo técnico oficial" available={available} description="Documento oficial gerado pela vistoria. Os links são temporários e preservam o acesso sensível."><div className="flex flex-wrap gap-2"><Button disabled={!available || loading} onClick={() => void viewResource('view')}><Eye />{loading ? 'Autorizando…' : 'Ver laudo'}</Button><Button disabled={!available || loading} variant="outline" onClick={() => void viewResource('download')}><Download />Baixar PDF</Button></div>{resources[0] && <a className="mt-4 inline-flex text-sm font-medium text-primary underline" href={resources[0].url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Abrir link autorizado</a>}{message && <Message text={message} />}</DocumentCard>;
  if (kind === 'fotos') return <DocumentCard title="Evidências fotográficas" available={available} description="Fotos acessadas por links temporários; elas não ficam públicas no Console."><Button disabled={!available || loading} onClick={() => void viewResource()}><Image />{loading ? 'Abrindo…' : 'Visualizar fotos'}</Button>{resources.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{resources.map((item, index) => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border bg-muted"><img src={item.url} alt={`Foto registrada ${index + 1}`} className="h-60 w-full object-cover" /><span className="flex items-center gap-2 p-3 text-sm font-medium">Foto {index + 1}<ExternalLink className="h-4 w-4" /></span></a>)}</div>}{message && <Message text={message} />}</DocumentCard>;
  if (kind === 'relatorio') return <><DocumentCard title="Gerar e editar relatório" available={available} description="Revise e edite os campos antes de imprimir ou salvar o relatório em PDF. A edição é aplicada somente à emissão atual."><div className="grid gap-5 lg:grid-cols-[1fr_.9fr]"><div className="space-y-2"><Label htmlFor="report-notes">Observações técnicas do vistoriador</Label><Textarea id="report-notes" rows={8} value={reportNotes} onChange={(event) => setReportNotes(event.target.value)} placeholder="Registre observações que devem constar nesta emissão…" /><p className="text-xs leading-5 text-muted-foreground">Os dados-base da vistoria permanecem imutáveis. Para alterar respostas da vistoria, utilize o fluxo operacional de correção.</p></div><DocumentFacts inspection={inspection} /></div><div className="mt-5 space-y-2"><Label htmlFor="base-legal">Base Legal</Label><Textarea id="base-legal" rows={4} value={baseLegal} onChange={(event) => setBaseLegal(event.target.value)} /><p className="text-xs leading-5 text-muted-foreground">Texto pré-preenchido com a base legal padrão do relatório. Edite apenas se houver norma específica para esta emissão.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Solicitante ou responsável" value={requesterName} onChange={setRequesterName} /><Field label="Nome do técnico (assinatura)" value={techName} onChange={setTechName} /><Field label="Cargo / função" value={techRole} onChange={setTechRole} /></div><div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4"><PenLine className="h-4 w-4 text-primary" /><p className="flex-1 text-sm"><span className="font-semibold">{signature.length ? `Assinatura capturada (${signature.length} traço${signature.length > 1 ? 's' : ''})` : 'Documento sem assinatura'}</span><span className="text-muted-foreground"> — a assinatura do agente é solicitada antes da emissão.</span></p>{signature.length > 0 && <Button variant="outline" onClick={() => setSignature([])}>Limpar assinatura</Button>}</div><Button className="mt-5" disabled={loading} onClick={() => requestPrint('relatorio')}><Printer />Gerar relatório / salvar PDF</Button>{message && <Message text={message} />}</DocumentCard>{signatureGateModal}</>;
  const mayGenerateTerm = ['r3', 'r4'].includes((inspection.risk ?? '').toLowerCase());
  return <><DocumentCard title="Gerar Termo de Interdição" available={available || mayGenerateTerm} description={mayGenerateTerm ? 'Preencha os dados do notificado e gere o termo no padrão operacional.' : 'O Termo de Interdição só pode ser emitido para vistorias classificadas como R3 ou R4.'}>{mayGenerateTerm && <><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do notificado" value={term.name} onChange={(name) => setTerm({ ...term, name })} /><Field label="CPF" value={term.cpf} onChange={(cpf) => setTerm({ ...term, cpf })} /><Field label="Rua" value={term.street} onChange={(street) => setTerm({ ...term, street })} /><Field label="Número" value={term.number} onChange={(number) => setTerm({ ...term, number })} /><Field label="Complemento" value={term.complement} onChange={(complement) => setTerm({ ...term, complement })} /><Field label="Bairro" value={term.district} onChange={(district) => setTerm({ ...term, district })} /><Field label="Cidade" value={term.city} onChange={(city) => setTerm({ ...term, city })} /><Field label="Telefone" value={term.phone} onChange={(phone) => setTerm({ ...term, phone })} /></div><div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4"><PenLine className="h-4 w-4 text-primary" /><p className="flex-1 text-sm"><span className="font-semibold">{signature.length ? `Assinatura capturada (${signature.length} traço${signature.length > 1 ? 's' : ''})` : 'Documento sem assinatura'}</span><span className="text-muted-foreground"> — a assinatura do agente é solicitada antes da emissão.</span></p>{signature.length > 0 && <Button variant="outline" onClick={() => setSignature([])}>Limpar assinatura</Button>}</div><Button className="mt-5" disabled={!inspection.canViewSensitive} onClick={() => requestPrint('termo')}><Printer />Gerar Termo / salvar PDF</Button></>}{message && <Message text={message} />}</DocumentCard>{signatureGateModal}</>;
}

function DocumentCard({ title, available, description, children }: { title: string; available: boolean; description: string; children: ReactNode }) { return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />{title}</CardTitle><Badge variant={available ? 'success' : 'secondary'}>{available ? 'Disponível' : 'Não gerado'}</Badge></div><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardHeader><CardContent>{children}</CardContent></Card>; }
function DocumentFacts({ inspection }: { inspection: Inspection }) { return <div className="rounded-xl border bg-muted/30 p-4"><p className="text-sm font-semibold">Dados que constarão no documento</p><dl className="mt-4 space-y-3 text-sm"><Fact label="Protocolo" value={inspection.protocol} /><Fact label="Risco" value={inspection.risk?.toUpperCase() ?? 'Não informado'} /><Fact label="Solicitante ou responsável" value={inspection.requesterName ?? 'Não informado'} /><Fact label="Agente" value={inspection.responsible ?? 'Não informado'} /><Fact label="Data" value={formatDate(inspection.occurredAt)} /></dl></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const id = useMemo(() => `term-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`, [label]); return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }

/** Área de assinatura manuscrita; produz traços normalizados (0–1) iguais aos do app. */
function SignaturePad({ strokes, onChange }: { strokes: SignatureStroke[]; onChange: (strokes: SignatureStroke[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentRef = useRef<SignaturePoint[]>([]);
  const context = () => canvasRef.current?.getContext('2d') ?? null;
  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>): SignaturePoint | null => {
    const canvas = canvasRef.current; const rect = canvas?.getBoundingClientRect(); if (!canvas || !rect) return null;
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const canvas = canvasRef.current; const point = pointAt(event); const ctx = context(); if (!canvas || !point || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    currentRef.current = [point];
    ctx.strokeStyle = '#172033'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(point.x * canvas.width, point.y * canvas.height); ctx.lineTo(point.x * canvas.width + 0.1, point.y * canvas.height + 0.1); ctx.stroke();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current; const point = pointAt(event); const ctx = context(); if (!canvas || !point || !ctx) return;
    const previous = currentRef.current[currentRef.current.length - 1];
    currentRef.current.push(point);
    ctx.beginPath(); ctx.moveTo(previous.x * canvas.width, previous.y * canvas.height); ctx.lineTo(point.x * canvas.width, point.y * canvas.height); ctx.stroke();
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current.length > 1) onChange([...strokes, { points: currentRef.current }]);
    currentRef.current = [];
  };
  const clear = () => { context()?.clearRect(0, 0, canvasRef.current?.width ?? 0, canvasRef.current?.height ?? 0); onChange([]); };
  return <div className="mt-2">
    <canvas ref={canvasRef} width={600} height={180} className="h-36 w-full touch-none rounded-xl border bg-white" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end} aria-label="Área de assinatura do agente" />
    <div className="mt-2 flex items-center justify-between">
      <p className="text-xs text-muted-foreground">Assine com o mouse, caneta ou o dedo na área acima.</p>
      <Button type="button" variant="outline" onClick={clear}>Limpar</Button>
    </div>
  </div>;
}
function Message({ text }: { text: string }) { return <Alert className="mt-5"><ShieldAlert className="h-4 w-4" /><AlertTitle>Emissão</AlertTitle><AlertDescription>{text}</AlertDescription></Alert>; }

function parseInspection(value: unknown): Inspection | null { if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const row = value as Record<string, unknown>; const documents = row.documents && typeof row.documents === 'object' && !Array.isArray(row.documents) ? row.documents as Record<string, unknown> : null; if (typeof row.id !== 'string' || typeof row.protocol !== 'string' || !documents) return null; const photoUrls = Array.isArray(row.photo_urls) ? row.photo_urls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)) : []; return { id: row.id, protocol: row.protocol, risk: stringValue(row.risk_level), score: numberValue(row.score), occurredAt: stringValue(row.occurred_at), municipality: stringValue(row.municipality), organization: stringValue(row.organization), responsible: stringValue(row.responsible_name) ?? stringValue(row.agent_name), address: stringValue(row.address), canViewSensitive: row.can_view_sensitive === true, documents: { laudo: documents.laudo === true, report: documents.report === true, term: documents.term === true }, photoCount: Math.max(0, Math.trunc(numberValue(row.photo_count) ?? 0)), formId: stringValue(row.form_id), agentName: stringValue(row.agent_name), requesterName: stringValue(row.responsible_name), answers: row.answers ?? null, riskSnapshot: row.risk_snapshot ?? null, photoUrls }; }
function parseResources(value: unknown, kind: 'laudo' | 'photo'): AuthorizedResource[] { if (!value || typeof value !== 'object' || Array.isArray(value)) return []; const row = value as Record<string, unknown>; if (row.ok !== true || row.kind !== kind || !Array.isArray(row.resources)) return []; return row.resources.flatMap((item): AuthorizedResource[] => { if (!item || typeof item !== 'object' || Array.isArray(item)) return []; const resource = item as Record<string, unknown>; return typeof resource.url === 'string' && resource.url.startsWith('https://') ? [{ url: resource.url, filename: typeof resource.filename === 'string' ? resource.filename : 'arquivo' }] : []; }); }
function stringValue(value: unknown): string | null { return typeof value === 'string' ? value : null; }
/** Busca um texto de resposta do formulário por chaves possíveis (ex.: nome do solicitante). */
function answerField(answers: unknown, keys: string[]): string | null {
  let record: Record<string, unknown> = {};
  if (typeof answers === 'string') { try { record = JSON.parse(answers) as Record<string, unknown>; } catch { return null; } }
  else if (answers && typeof answers === 'object' && !Array.isArray(answers)) record = answers as Record<string, unknown>;
  for (const key of keys) { const value = record[key]; if (typeof value === 'string' && value.trim()) return value.trim(); }
  return null;
}
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function formatDate(value: string | null) { if (!value) return 'Data não informada'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR'); }
