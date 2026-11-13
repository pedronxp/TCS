import { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { inspectionMediaLabel, nextInspectionMediaManifest, parseInspectionMediaStatus } from '@/lib/inspectionWorkflow';
import type { InspectionMediaManifest } from '../../../utils/inspectionMedia';

export function InspectionMediaPanel({ inspectionId, mediaStatus, photoPaths, onUpdated }: { inspectionId: string; mediaStatus: unknown; photoPaths: string[]; onUpdated: () => void }) {
  const status = parseInspectionMediaStatus(mediaStatus, photoPaths.length);
  const manifest = mediaStatus && typeof mediaStatus === 'object' ? (mediaStatus as { manifest?: InspectionMediaManifest }).manifest ?? null : null;
  const input = useRef<HTMLInputElement>(null);
  const pendingId = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState('');
  const items = manifest?.items.filter(i => i.state !== 'removed') ?? [];
  const pending = items.find(i => i.state !== 'available');
  async function save(next: InspectionMediaManifest) {
    const remote = next.items.filter(i => i.state === 'available').map(i => i.storagePath!);
    const { error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ error: Error | null }>)('update_inspection_media', {
      p_inspection_id: inspectionId, p_primary_photo: remote[0] ?? null, p_extra_photos: remote.slice(1), p_media_manifest: next,
    });
    if (error) throw error;
    onUpdated();
  }
  async function upload(file: File) {
    if (lock.current) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) { setMessage('Escolha uma foto JPEG ou PNG de até 10 MB.'); return; }
    lock.current = true; setBusy(true); setMessage(null);
    try {
      const { data: authorized, error } = await supabase.functions.invoke('inspection-upload-authorize', { body: { inspectionId, kind: 'photo', contentType: file.type } });
      if (error || authorized?.bucket !== 'fotos' || !authorized.path || !authorized.token || !authorized.persistencePath) throw new Error('Não foi possível autorizar o envio.');
      const sent = await supabase.storage.from('fotos').uploadToSignedUrl(authorized.path, authorized.token, file, { contentType: file.type });
      if (sent.error) throw sent.error;
      await save(nextInspectionMediaManifest(inspectionId, manifest, photoPaths, authorized.persistencePath, pendingId.current));
      setMessage('Foto registrada. Documentos já emitidos continuam vinculados às versões anteriores.');
    } catch (e) { setMessage(e instanceof Error && /media_revision_conflict/.test(e.message) ? 'As fotos foram alteradas em outro aparelho. Atualize a vistoria antes de tentar novamente.' : e instanceof Error ? e.message : 'Não foi possível enviar a foto.'); }
    finally { lock.current = false; setBusy(false); pendingId.current = undefined; if (input.current) input.current.value = ''; }
  }
  async function remove(id: string) {
    if (lock.current || !window.confirm('Remover esta evidência da vistoria? As versões anteriores dos documentos serão preservadas.')) return;
    lock.current = true; setBusy(true); setMessage(null);
    try { await save(nextInspectionMediaManifest(inspectionId, manifest, photoPaths, null, id)); }
    catch { setMessage('Não foi possível remover. Atualize a vistoria e tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function waive() {
    if (lock.current || waiverReason.trim().length < 8 || status.revision === null) return;
    if (!window.confirm('Registrar a dispensa destas evidências pendentes com o motivo informado? O motivo ficará no histórico e no documento final.')) return;
    lock.current = true; setBusy(true); setMessage(null);
    try {
      const { error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ error: Error | null }>)('waive_inspection_missing_media', { p_inspection_id: inspectionId, p_reason: waiverReason.trim(), p_media_revision: status.revision });
      if (error) throw error;
      setMessage('Dispensa registrada para esta versão das evidências. A responsabilidade técnica continua sendo exigida.'); onUpdated();
    } catch { setMessage('Não foi possível registrar a dispensa. É necessário ser proprietário ou revisor autorizado para esta vistoria.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border p-4">
    <p className="font-medium">Sincronização das fotos</p>
    <p className="text-sm text-muted-foreground" role="status">{inspectionMediaLabel(status)}</p>
    {!status.complete && <p className="text-xs text-muted-foreground">Fotos que ficaram somente no celular precisam ser enviadas por ele quando reconectar. Você também pode anexar uma evidência substituta autorizada aqui.</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={onUpdated}><RefreshCw className="h-4 w-4" />Atualizar estado</Button>
      <Button size="sm" disabled={busy || (!pending && (status.expected_count ?? photoPaths.length) >= 3)} onClick={() => { pendingId.current = pending?.id; input.current?.click(); }}><ImagePlus className="h-4 w-4" />{busy ? 'Enviando…' : pending ? 'Substituir foto pendente' : 'Adicionar foto'}</Button>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" aria-label="Selecionar evidência fotográfica" onChange={e => { if (e.target.files?.[0]) void upload(e.target.files[0]); }} />
    </div>
    {items.map((item, index) => <div className="flex items-center justify-between gap-3 text-sm" key={item.id}><span>Foto {index + 1} · {item.state === 'available' ? 'Disponível' : 'Pendente de envio'}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(item.id)} aria-label={`Remover foto ${index + 1}`}><Trash2 className="h-4 w-4" /></Button></div>)}
    {Boolean(status.pending_count) && <div className="space-y-2 border-t pt-3"><label htmlFor="media-waiver" className="block text-sm font-medium">Dispensa de evidências — proprietário ou revisor</label><textarea id="media-waiver" className="w-full rounded-lg border bg-background p-2 text-sm" rows={3} maxLength={1000} value={waiverReason} onChange={e => setWaiverReason(e.target.value)} placeholder="Justifique por que a emissão pode prosseguir sem estas fotos…" /><Button size="sm" variant="outline" disabled={busy || waiverReason.trim().length < 8} onClick={() => void waive()}>Registrar dispensa justificada</Button></div>}
    {message && <p className="text-sm" role="alert">{message}</p>}
  </div>;
}
