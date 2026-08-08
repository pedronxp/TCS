import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileText, LoaderCircle, ShieldCheck } from 'lucide-react';
import { supabaseConfigurationAvailable } from '@/lib/supabase';

type Outcome = 'acknowledged' | 'refused' | 'unable_to_sign';
type SignaturePoint = { x: number; y: number };
type SignatureStroke = { points: SignaturePoint[] };
type LinkDocument = { type: string; protocol: string | null; address: string | null };

const DECLARATION = 'Declaro que tive acesso ao documento apresentado, recebi as orientações nele registradas e estou ciente de seu conteúdo. Esta ciência registra o recebimento e não substitui assinatura digital qualificada.';

function endpoint() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url ? `${url}/functions/v1/remote-document-acknowledgement` : '';
}

function outcomeLabel(outcome: Outcome) {
  return outcome === 'acknowledged' ? 'Ciente' : outcome === 'refused' ? 'Recusa' : 'Impossibilidade';
}

export function DocumentAcknowledgementLinkPage() {
  const { token = '' } = useParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [document, setDocument] = useState<LinkDocument | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>('acknowledged');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Morador ou responsável');
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState<SignatureStroke[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const url = endpoint();
    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !apiKey || !supabaseConfigurationAvailable) throw new Error('A página de ciência não está configurada. Solicite outro link ao agente.');
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
    canvas.width = Math.max(1, Math.floor(bounds.width * scale));
    canvas.height = Math.max(1, Math.floor(bounds.height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.strokeStyle = '#172033';
    context.lineWidth = 2.4;
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

  useEffect(() => { draw(signature); }, [draw, signature]);

  const point = (event: PointerEvent<HTMLCanvasElement>): SignaturePoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const startSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setSignature((previous) => [...previous, { points: [point(event)] }]);
  };

  const extendSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const nextPoint = point(event);
    setSignature((previous) => previous.map((stroke, index) => index === previous.length - 1
      ? { points: [...stroke.points, nextPoint] }
      : stroke));
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

  if (loading) return <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6 text-muted-foreground"><LoaderCircle className="mr-3 h-5 w-5 animate-spin" />Carregando documento seguro…</main>;
  if (protocol) return <main className="mx-auto flex min-h-screen max-w-2xl items-center p-6"><section className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600" /><h1 className="mt-4 text-2xl font-bold">Ciência registrada</h1><p className="mt-2 text-muted-foreground">Protocolo: <strong className="text-foreground">{protocol}</strong></p><p className="mt-4 text-sm text-muted-foreground">Este link foi encerrado e não pode ser utilizado novamente.</p></section></main>;
  if (error && !document) return <main className="mx-auto flex min-h-screen max-w-2xl items-center p-6"><section className="w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-7 text-center"><h1 className="text-xl font-bold">Link indisponível</h1><p className="mt-2 text-muted-foreground">{error}</p></section></main>;

  return <main className="min-h-screen bg-muted/30 py-8"><section className="mx-auto max-w-2xl px-4"><p className="text-xs font-extrabold tracking-[0.14em] text-primary">TCS · DEFESA CIVIL</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Ciência eletrônica</h1><p className="mt-2 text-sm text-muted-foreground">Leia o documento e registre o recebimento. O link é individual e tem uso único.</p>
    <div className="mt-5 rounded-2xl border bg-card p-5 shadow-sm"><div className="flex gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><FileText className="h-5 w-5" /></div><div><h2 className="font-bold">{document?.type === 'interdiction_term' ? 'Termo de interdição' : 'Relatório de vistoria'}</h2><p className="mt-1 text-sm text-muted-foreground">{[document?.protocol, document?.address].filter(Boolean).join(' · ')}</p></div></div>{signedUrl && <iframe className="mt-5 h-[470px] w-full rounded-xl border bg-white" title="Documento apresentado" src={signedUrl} />}</div>
    <form onSubmit={submit} className="mt-5 rounded-2xl border bg-card p-5 shadow-sm"><h2 className="text-lg font-bold">Resultado da apresentação</h2><div className="mt-4 grid grid-cols-3 gap-2">{(['acknowledged', 'refused', 'unable_to_sign'] as Outcome[]).map((value) => <button key={value} type="button" onClick={() => setOutcome(value)} className={`rounded-xl border px-2 py-3 text-sm font-bold ${outcome === value ? 'border-primary bg-primary/10 text-primary' : 'bg-background text-muted-foreground'}`}>{outcomeLabel(value)}</button>)}</div>
      <label className="mt-5 block text-sm font-bold">Nome do destinatário<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-3 font-normal" /></label><label className="mt-4 block text-sm font-bold">Relação com o atendimento<input required value={relationship} onChange={(event) => setRelationship(event.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-3 font-normal" /></label>
      {outcome === 'acknowledged' ? <><label className="mt-5 flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm leading-5 text-muted-foreground"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4" />{DECLARATION}</label><label className="mt-5 block text-sm font-bold">Assinatura manuscrita</label><canvas ref={canvasRef} onPointerDown={startSignature} onPointerMove={extendSignature} onPointerUp={() => { drawingRef.current = false; }} onPointerCancel={() => { drawingRef.current = false; }} className="mt-2 h-44 w-full touch-none rounded-xl border bg-white" /><button type="button" onClick={() => setSignature([])} className="mt-2 text-sm font-bold text-destructive">Limpar assinatura</button></> : <label className="mt-5 block text-sm font-bold">Motivo<textarea required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border bg-background px-3 py-3 font-normal" /></label>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}<div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />O registro será vinculado à versão exibida acima.</div><button disabled={submitting} className="mt-4 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60">{submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : 'Registrar ciência'}</button>
    </form></section></main>;
}
