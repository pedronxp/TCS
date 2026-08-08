import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
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
import { supabaseConfigurationAvailable } from '@/lib/supabase';

type Outcome = 'acknowledged' | 'refused' | 'unable_to_sign';
type SignaturePoint = { x: number; y: number };
type SignatureStroke = { points: SignaturePoint[] };
type LinkDocument = { type: string; protocol: string | null; address: string | null };

const DECLARATION = 'Declaro que tive acesso ao documento apresentado, recebi as orientações nele registradas e estou ciente de seu conteúdo. Esta ciência registra o recebimento e não substitui assinatura digital qualificada.';

const OUTCOMES: Array<{
  value: Outcome;
  label: string;
  description: string;
  icon: typeof Check;
}> = [
  { value: 'acknowledged', label: 'Ciente', description: 'Recebi e compreendi', icon: Check },
  { value: 'refused', label: 'Recusa', description: 'Não aceito registrar', icon: X },
  { value: 'unable_to_sign', label: 'Impossibilidade', description: 'Não foi possível assinar', icon: AlertCircle },
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
  const [document, setDocument] = useState<LinkDocument | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>('acknowledged');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Morador ou responsável');
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState<SignatureStroke[]>([]);
  const [showDocument, setShowDocument] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);

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
        setDocument(result.document as LinkDocument);
        setSignedUrl(result.signed_url as string);
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (outcome === 'acknowledged' && (!accepted || signature.length === 0)) {
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
      setProtocol(result.result?.protocol || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a ciência.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-muted-foreground"><LoaderCircle className="mr-3 h-5 w-5 animate-spin" />Carregando documento seguro…</main>;
  }

  if (protocol) {
    return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4 sm:p-8"><section className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"><CheckCircle2 className="h-9 w-9 text-primary" /></div><p className="mt-5 text-xs font-extrabold tracking-[0.14em] text-primary">TCS · DEFESA CIVIL</p><h1 className="mt-2 text-2xl font-bold">Ciência registrada</h1><p className="mt-3 text-muted-foreground">O recebimento foi registrado com sucesso.</p><div className="mt-6 rounded-xl border bg-muted/40 px-4 py-3 text-sm">Protocolo <strong>{protocol}</strong></div><p className="mt-5 text-xs leading-5 text-muted-foreground">Este link foi encerrado e não pode ser utilizado novamente.</p></section></main>;
  }

  if (error && !document) {
    return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4 sm:p-8"><section className="w-full max-w-lg rounded-3xl border border-destructive/30 bg-card p-8 text-center"><AlertCircle className="mx-auto h-10 w-10 text-destructive" /><h1 className="mt-4 text-xl font-bold">Link indisponível</h1><p className="mt-2 text-muted-foreground">{error}</p></section></main>;
  }

  const documentTitle = document?.type === 'interdiction_term' ? 'Termo de interdição' : 'Relatório de vistoria';

  return <main className="min-h-screen bg-muted/30">
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><FileCheck2 className="h-6 w-6" /></div>
          <div><p className="text-xs font-extrabold tracking-[0.14em] text-primary">TCS · DEFESA CIVIL</p><p className="mt-0.5 text-sm font-semibold text-muted-foreground">Recebimento seguro de documento</p></div>
        </div>
        <div className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4 text-primary" />Link individual · uso único</div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ciência eletrônica</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Leia o documento, confirme seus dados e assine diretamente nesta página.</p>
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
              <button type="button" onClick={() => setShowDocument((value) => !value)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-bold"><ChevronDown className={`h-4 w-4 transition-transform ${showDocument ? 'rotate-180' : ''}`} />{showDocument ? 'Ocultar prévia' : 'Ver prévia aqui'}</button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Visualização gratuita pelo navegador. Não exige Adobe nem assinatura paga.</p>
          </div>
          {showDocument && signedUrl && <div className="border-t bg-muted/30 p-2 sm:p-4"><iframe className="h-[58vh] min-h-[390px] w-full rounded-xl border bg-white lg:h-[680px]" title="Documento apresentado" src={signedUrl} /></div>}
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
              <div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Assinatura manuscrita <span className="text-destructive">*</span></p><p className="mt-0.5 text-xs text-muted-foreground">Use o dedo, caneta ou mouse</p></div>{signature.length > 0 && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"><Check className="h-3.5 w-3.5" />Assinatura capturada</span>}</div>
              <div className="relative mt-3 overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-white">
                <canvas ref={canvasRef} onPointerDown={startSignature} onPointerMove={extendSignature} onPointerUp={finishSignature} onPointerCancel={finishSignature} className="block h-48 w-full cursor-crosshair touch-none [touch-action:none]" aria-label="Área para assinatura manuscrita" />
                {signature.length === 0 && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="text-center text-muted-foreground"><PenLine className="mx-auto h-7 w-7" /><p className="mt-2 text-sm font-semibold">Assine dentro desta área</p></div></div>}
                <div className="pointer-events-none absolute bottom-8 left-8 right-8 border-b border-border" />
              </div>
              <button type="button" onClick={() => setSignature([])} disabled={signature.length === 0} className="mt-2 text-xs font-bold text-destructive disabled:cursor-not-allowed disabled:opacity-40">Limpar assinatura</button>
            </> : <label className="mt-5 block text-sm font-bold">Informe o motivo <span className="text-destructive">*</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo do registro" className="mt-2 min-h-28 w-full resize-y rounded-xl border bg-background px-4 py-3 font-normal outline-none ring-primary focus:ring-2" /></label>}

            {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />A assinatura e o resultado serão vinculados exclusivamente à versão do documento exibida nesta página.</div>
            <button disabled={submitting} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground disabled:opacity-60">{submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <><FileCheck2 className="h-5 w-5" />Registrar ciência</>}</button>
          </section>
        </form>
      </div>

      <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row"><span>TCS · Tecnologia para Defesa Civil</span><span>Registro eletrônico protegido e auditável</span></footer>
    </div>
  </main>;
}
