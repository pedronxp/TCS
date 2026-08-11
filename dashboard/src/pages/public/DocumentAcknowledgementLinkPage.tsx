import { FormEvent, KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
  PenLine,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';
import { supabaseConfigurationAvailable } from '@/lib/supabase';

type Outcome = 'acknowledged' | 'refused' | 'unable_to_sign';
type SignaturePoint = { x: number; y: number };
type SignatureStroke = { points: SignaturePoint[] };
type LinkDocument = { type: string; protocol: string | null; address: string | null };
type SubmissionResult = { protocol: string; outcome: Outcome };
type DocumentView = { document: LinkDocument; signedUrl: string };

const KEYBOARD_SIGNATURE_STEP = 0.06;
const MIN_SIGNATURE_DISPLACEMENT = 0.02;

const DECLARATION = 'Declaro que tive acesso ao documento apresentado, recebi as orientações nele registradas e estou ciente de seu conteúdo. Esta ciência registra o recebimento e não substitui assinatura digital qualificada.';

const OUTCOMES: Array<{
  value: Outcome;
  label: string;
  description: string;
  icon: typeof Check;
}> = [
  { value: 'acknowledged', label: 'Reconhecer ciência', description: 'Li e vou assinar', icon: Check },
  { value: 'refused', label: 'Registrar recusa', description: 'Não reconheço a ciência', icon: X },
  { value: 'unable_to_sign', label: 'Informar impossibilidade', description: 'Não foi possível assinar', icon: AlertCircle },
];

function endpoint() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url ? `${url}/functions/v1/remote-document-acknowledgement` : '';
}

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): SignaturePoint {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(bounds.width, 1))),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(bounds.height, 1))),
  };
}

export function DocumentAcknowledgementLinkPage() {
  const { token = '' } = useParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const keyboardDrawingRef = useRef(false);
  const keyboardPointRef = useRef<SignaturePoint>({ x: 0.5, y: 0.5 });
  const keyboardStrokeStartRef = useRef<SignaturePoint | null>(null);
  const [document, setDocument] = useState<LinkDocument | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>('acknowledged');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Morador ou responsável');
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState<SignatureStroke[]>([]);
  const [keyboardSignatureStatus, setKeyboardSignatureStatus] = useState('Assinatura por teclado pronta.');
  const [showDocument, setShowDocument] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const url = endpoint();
    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !apiKey || !supabaseConfigurationAvailable) {
      throw new Error('A página de ciência não está configurada. Solicite outro link ao agente.');
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ ...payload, token }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
    return result;
  }, [token]);

  useEffect(() => {
    let active = true;
    request({ action: 'view' })
      .then((result) => {
        if (!active) return;
        const view = parseDocumentView(result);
        setDocument(view.document);
        setSignedUrl(view.signedUrl);
      })
      .catch((cause: Error) => active && setError(cause.message === 'link_expired'
        ? 'Este link expirou. Solicite um novo ao agente responsável.'
        : 'Este link não está disponível.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [request]);

  const draw = useCallback((strokes: SignatureStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(bounds.width * scale));
    const height = Math.max(1, Math.floor(bounds.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.strokeStyle = '#172033';
    context.lineWidth = 2.6;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    strokes.forEach((stroke) => {
      context.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * bounds.width;
        const y = point.y * bounds.height;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    });
  }, []);

  useEffect(() => {
    draw(signature);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => draw(signature));
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [draw, signature]);

  const startSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = event.currentTarget;
    const firstPoint = getCanvasPoint(canvas, event.clientX, event.clientY);
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    activePointerRef.current = event.pointerId;
    setSignature((previous) => [...previous, { points: [firstPoint] }]);
  };

  const extendSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const nextPoint = getCanvasPoint(event.currentTarget, event.clientX, event.clientY);
    setSignature((previous) => previous.map((stroke, index) => index === previous.length - 1
      ? { points: [...stroke.points, nextPoint] }
      : stroke));
  };

  const finishSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    drawingRef.current = false;
    activePointerRef.current = null;
    setSignature((previous) => {
      const lastStroke = previous.at(-1);
      return lastStroke && !isVisibleStroke(lastStroke) ? previous.slice(0, -1) : previous;
    });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearSignature = () => {
    keyboardDrawingRef.current = false;
    keyboardPointRef.current = { x: 0.5, y: 0.5 };
    keyboardStrokeStartRef.current = null;
    setSignature([]);
    setKeyboardSignatureStatus('Assinatura limpa. Pressione Enter ou Espaço para iniciar um novo traço.');
  };

  const handleSignatureKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (keyboardDrawingRef.current) {
        keyboardDrawingRef.current = false;
        const start = keyboardStrokeStartRef.current;
        keyboardStrokeStartRef.current = null;
        if (!start || !hasMeaningfulDisplacement(start, keyboardPointRef.current)) {
          setSignature((previous) => previous.slice(0, -1));
          setKeyboardSignatureStatus('Traço sem deslocamento descartado. Use as setas para criar uma assinatura visível.');
        } else {
          setKeyboardSignatureStatus('Traço finalizado. Pressione Enter ou Espaço para iniciar outro traço.');
        }
      } else {
        keyboardDrawingRef.current = true;
        const start = keyboardPointRef.current;
        keyboardStrokeStartRef.current = start;
        setSignature((previous) => [...previous, { points: [start] }]);
        setKeyboardSignatureStatus('Traço iniciado. Use as setas para estender e Enter ou Espaço para finalizar.');
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      clearSignature();
      return;
    }

    const directions: Record<string, SignaturePoint> = {
      ArrowUp: { x: 0, y: -KEYBOARD_SIGNATURE_STEP },
      ArrowDown: { x: 0, y: KEYBOARD_SIGNATURE_STEP },
      ArrowLeft: { x: -KEYBOARD_SIGNATURE_STEP, y: 0 },
      ArrowRight: { x: KEYBOARD_SIGNATURE_STEP, y: 0 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const current = keyboardPointRef.current;
    const next = {
      x: Math.max(0, Math.min(1, current.x + direction.x)),
      y: Math.max(0, Math.min(1, current.y + direction.y)),
    };
    keyboardPointRef.current = next;
    if (keyboardDrawingRef.current) {
      setSignature((previous) => previous.map((stroke, index) => index === previous.length - 1
        ? { points: [...stroke.points, next] }
        : stroke));
      setKeyboardSignatureStatus(`Traço estendido para ${Math.round(next.x * 100)}% horizontal e ${Math.round(next.y * 100)}% vertical.`);
    } else {
      setKeyboardSignatureStatus(`Cursor movido para ${Math.round(next.x * 100)}% horizontal e ${Math.round(next.y * 100)}% vertical.`);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (outcome === 'acknowledged' && (!accepted || !isVisibleSignature(signature))) {
      setError('Leia e aceite a declaração e faça a assinatura antes de continuar.');
      return;
    }
    if (outcome !== 'acknowledged' && reason.trim().length < 3) {
      setError('Informe o motivo para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await request({
        action: 'sign', outcome, recipient_name: name, recipient_relationship: relationship,
        declaration_version: 'tcs-ack-v1', declaration_text: DECLARATION,
        signature_strokes: outcome === 'acknowledged' ? signature : null,
        reason: outcome === 'acknowledged' ? null : reason,
      });
      const nextProtocol = result.result?.protocol;
      if (typeof nextProtocol !== 'string' || !nextProtocol) throw new Error('O servidor não retornou o protocolo do registro.');
      setSubmissionResult({ protocol: nextProtocol, outcome });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a ciência.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-muted-foreground"><LoaderCircle className="mr-3 h-5 w-5 animate-spin motion-reduce:animate-none" />Carregando documento seguro…</main>;
  }

  if (submissionResult) {
    const resultCopy = acknowledgementResultCopy(submissionResult.outcome);
    return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4 sm:p-8"><section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm" role="status"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10"><CheckCircle2 className="h-8 w-8 text-primary" /></div><p className="mt-5 text-xs font-extrabold tracking-[0.14em] text-primary">TCS · DEFESA CIVIL</p><h1 className="mt-2 text-2xl font-bold">{resultCopy.title}</h1><p className="mt-3 leading-6 text-muted-foreground">{resultCopy.text}</p><dl className="mt-6 rounded-xl border bg-muted/40 px-4 py-3 text-sm"><dt className="text-xs text-muted-foreground">Protocolo auditável</dt><dd className="mt-1 font-bold">{submissionResult.protocol}</dd></dl><p className="mt-5 text-xs leading-5 text-muted-foreground">O resultado foi vinculado à versão exibida do documento. Este link foi encerrado e não pode ser utilizado novamente.</p></section></main>;
  }

  if (error && !document) {
    return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4 sm:p-8"><section className="w-full max-w-lg rounded-3xl border border-destructive/30 bg-card p-8 text-center"><AlertCircle className="mx-auto h-10 w-10 text-destructive" /><h1 className="mt-4 text-xl font-bold">Link indisponível</h1><p className="mt-2 text-muted-foreground">{error}</p></section></main>;
  }

  const documentTitle = document?.type === 'interdiction_term' ? 'Termo de interdição' : 'Relatório de vistoria';
  const hasVisibleSignature = isVisibleSignature(signature);

  return <main className="min-h-screen bg-muted/30">
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <TcsMark decorative size={48} />
          <div><p className="text-xs font-extrabold tracking-[0.14em] text-primary">TCS · DEFESA CIVIL</p><p className="mt-0.5 text-sm font-semibold text-muted-foreground">Recebimento seguro de documento</p></div>
        </div>
        <div className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4 text-primary" />Link individual · uso único</div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ciência eletrônica</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Confira a versão apresentada, identifique quem recebeu e registre ciência, recusa ou impossibilidade de assinatura.</p>
      </div>

      <ol className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border bg-card" aria-label="Etapas da ciência eletrônica">
        {[
          { label: 'Documento', icon: FileText },
          { label: 'Identificação', icon: UserRound },
          { label: 'Assinatura', icon: PenLine },
        ].map((step, index) => <li key={step.label} className={`flex items-center justify-center gap-2 px-2 py-3 text-xs font-bold sm:text-sm ${index < 2 ? 'border-r' : ''}`}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">{index + 1}</span><step.icon className="hidden h-4 w-4 text-primary sm:block" /><span>{step.label}</span></li>)}
      </ol>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(23rem,.82fr)]">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm lg:sticky lg:top-6">
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Documento apresentado</p><h2 className="mt-1 text-lg font-bold">{documentTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{document?.protocol || 'Sem protocolo'}</p></div>
            </div>
            {document?.address && <p className="mt-4 rounded-xl bg-muted/50 px-4 py-3 text-sm font-medium">{document.address}</p>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a href={signedUrl || '#'} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><ExternalLink className="h-4 w-4" />Abrir documento</a>
              <button type="button" onClick={() => setShowDocument((value) => !value)} aria-expanded={showDocument} aria-controls="document-preview" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-bold"><ChevronDown className={`h-4 w-4 ${showDocument ? 'rotate-180' : ''}`} />{showDocument ? 'Ocultar prévia' : 'Ver prévia aqui'}</button>
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">A prévia e o formulário permanecem vinculados à mesma versão do documento durante todo o registro.</p>
          </div>
          <div id="document-preview" hidden={!showDocument} className="border-t bg-muted/30 p-2 sm:p-4">{signedUrl && <iframe className="h-[58vh] min-h-[390px] w-full rounded-xl border bg-white lg:h-[680px]" title="Documento apresentado" src={signedUrl} />}</div>
        </section>

        <form onSubmit={submit} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <section className="border-b p-4 sm:p-5">
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">2</span><div><h2 className="font-bold">Identificação do destinatário</h2><p className="text-xs text-muted-foreground">Dados de quem recebeu o documento</p></div></div>
            <label className="mt-5 block text-sm font-bold">Nome completo <span className="text-destructive">*</span><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Digite o nome de quem recebeu" className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 font-normal outline-none ring-primary focus:ring-2" /></label>
            <label className="mt-4 block text-sm font-bold">Relação com o atendimento <span className="text-destructive">*</span><input required value={relationship} onChange={(event) => setRelationship(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 font-normal outline-none ring-primary focus:ring-2" /></label>
          </section>

          <section className="border-b p-4 sm:p-5">
            <h2 className="font-bold">Resultado da apresentação</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">{OUTCOMES.map((option) => {
              const Icon = option.icon;
              const selected = outcome === option.value;
              return <button key={option.value} type="button" onClick={() => { setOutcome(option.value); setError(null); }} aria-pressed={selected} className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left sm:block ${selected ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-muted/40'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}><Icon className="h-4 w-4" /></span><span className="sm:mt-2 sm:block"><strong className="block text-sm">{option.label}</strong><span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{option.description}</span></span></button>;
            })}</div>
          </section>

          <section className="p-4 sm:p-5">
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">3</span><div><h2 className="font-bold">{outcome === 'acknowledged' ? 'Declaração e assinatura' : 'Justificativa'}</h2><p className="text-xs text-muted-foreground">Finalize o registro de recebimento</p></div></div>
            {outcome === 'acknowledged' ? <>
              <label className="mt-5 flex cursor-pointer gap-3 rounded-xl border bg-muted/35 p-4 text-sm leading-5 text-muted-foreground"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" /><span>{DECLARATION}</span></label>
              <div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Assinatura manuscrita <span className="text-destructive">*</span></p><p className="mt-0.5 text-xs text-muted-foreground">Use o dedo, caneta, mouse ou teclado</p></div>{hasVisibleSignature && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"><Check className="h-3.5 w-3.5" />Assinatura capturada</span>}</div>
              <p id="keyboard-signature-instructions" className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">Pelo teclado: foque a área de assinatura, pressione Enter ou Espaço para iniciar, use as setas para estender o traço e pressione Enter ou Espaço novamente para finalizar. Delete ou Backspace limpa todos os traços.</p>
              <div className="relative mt-3 overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-white">
                <canvas ref={canvasRef} role="application" tabIndex={0} aria-label="Área para assinatura manuscrita" aria-describedby="keyboard-signature-instructions" onKeyDown={handleSignatureKeyDown} onPointerDown={startSignature} onPointerMove={extendSignature} onPointerUp={finishSignature} onPointerCancel={finishSignature} className="block h-48 w-full cursor-crosshair touch-none outline-none ring-primary [touch-action:none] focus-visible:ring-2 focus-visible:ring-inset" />
                {!hasVisibleSignature && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="text-center text-muted-foreground"><PenLine className="mx-auto h-7 w-7" /><p className="mt-2 text-sm font-semibold">Assine dentro desta área</p></div></div>}
                <div className="pointer-events-none absolute bottom-8 left-8 right-8 border-b border-border" />
              </div>
              <p className="sr-only" role="status" aria-live="polite">{keyboardSignatureStatus}</p>
              <button type="button" onClick={clearSignature} disabled={signature.length === 0} className="mt-2 rounded-sm text-xs font-bold text-destructive outline-none ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">Limpar assinatura</button>
            </> : <label className="mt-5 block text-sm font-bold">Informe o motivo <span className="text-destructive">*</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo do registro" className="mt-2 min-h-28 w-full resize-y rounded-xl border bg-background px-4 py-3 font-normal outline-none ring-primary focus:ring-2" /></label>}

            {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />A assinatura e o resultado serão vinculados exclusivamente à versão do documento exibida nesta página.</div>
            <button disabled={submitting} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground disabled:opacity-60">{submitting ? <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <><FileCheck2 className="h-5 w-5" aria-hidden="true" />{submissionActionLabel(outcome)}</>}</button>
          </section>
        </form>
      </div>

      <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row"><span>TCS · Tecnologia para Defesa Civil</span><span>Registro eletrônico protegido e auditável</span></footer>
    </div>
  </main>;
}

function submissionActionLabel(outcome: Outcome) {
  if (outcome === 'refused') return 'Registrar recusa';
  if (outcome === 'unable_to_sign') return 'Registrar impossibilidade';
  return 'Registrar ciência e assinatura';
}

function hasMeaningfulDisplacement(first: SignaturePoint, next: SignaturePoint) {
  return Math.hypot(next.x - first.x, next.y - first.y) >= MIN_SIGNATURE_DISPLACEMENT;
}

function isVisibleStroke(stroke: SignatureStroke) {
  if (stroke.points.length < 2) return false;
  const first = stroke.points[0];
  return stroke.points.slice(1).some((point) => hasMeaningfulDisplacement(first, point));
}

function isVisibleSignature(strokes: SignatureStroke[]) {
  return strokes.some(isVisibleStroke);
}

function acknowledgementResultCopy(outcome: Outcome) {
  if (outcome === 'refused') {
    return {
      title: 'Recusa registrada',
      text: 'A recusa e a justificativa informada foram registradas pelo servidor.',
    };
  }
  if (outcome === 'unable_to_sign') {
    return {
      title: 'Impossibilidade registrada',
      text: 'A impossibilidade de assinatura e a justificativa informada foram registradas pelo servidor.',
    };
  }
  return {
    title: 'Ciência e assinatura registradas',
    text: 'A declaração de ciência e a assinatura manuscrita foram registradas pelo servidor.',
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseDocumentView(value: unknown): DocumentView {
  if (!value || typeof value !== 'object') throw new Error('invalid_document_response');
  const response = value as Record<string, unknown>;
  const candidate = response.document;
  if (!candidate || typeof candidate !== 'object') throw new Error('invalid_document_response');
  const document = candidate as Record<string, unknown>;
  if (
    typeof document.type !== 'string'
    || document.type.trim().length === 0
    || !isNullableString(document.protocol)
    || !isNullableString(document.address)
    || typeof response.signed_url !== 'string'
  ) {
    throw new Error('invalid_document_response');
  }

  let signedUrl: URL;
  try {
    signedUrl = new URL(response.signed_url);
  } catch {
    throw new Error('invalid_document_response');
  }
  if (signedUrl.protocol !== 'https:') throw new Error('invalid_document_response');

  return {
    document: {
      type: document.type,
      protocol: document.protocol,
      address: document.address,
    },
    signedUrl: signedUrl.href,
  };
}
