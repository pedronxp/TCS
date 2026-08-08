import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

function isSignature(value: unknown): value is Array<{ points: Array<{ x: number; y: number }> }> {
  return Array.isArray(value) && value.length > 0 && value.every(stroke =>
    stroke && typeof stroke === 'object' && Array.isArray((stroke as { points?: unknown }).points)
      && (stroke as { points: unknown[] }).points.length > 0
      && (stroke as { points: Array<{ x: unknown; y: unknown }> }).points.every(point =>
        typeof point?.x === 'number' && Number.isFinite(point.x) && point.x >= 0 && point.x <= 1
        && typeof point?.y === 'number' && Number.isFinite(point.y) && point.y >= 0 && point.y <= 1
      )
  );
}

type RequestRow = {
  id: string;
  status: string;
  expires_at: string;
  document_id: string;
  generated_documents: {
    id: string;
    document_type: string;
    storage_path: string;
    status: string;
    training_mode: boolean;
    owner_user_id: string;
    vistoria_id: string;
    content_snapshot: Record<string, unknown>;
  } | null;
};

async function getRequest(token: string): Promise<RequestRow | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = await sha256(token);
  const { data } = await admin
    .from('document_acknowledgement_requests')
    .select('id,status,expires_at,document_id,generated_documents(id,document_type,storage_path,status,training_mode,owner_user_id,vistoria_id,content_snapshot)')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  return data as RequestRow | null;
}

function availabilityError(request: RequestRow | null): string | null {
  if (!request || !request.generated_documents) return 'link_not_found';
  if (request.status !== 'open') return request.status === 'expired' ? 'link_expired' : 'link_unavailable';
  if (new Date(request.expires_at).getTime() <= Date.now()) return 'link_expired';
  if (request.generated_documents.status !== 'available' || request.generated_documents.training_mode) return 'document_unavailable';
  return null;
}

function linkPage(request: Request): Response {
  const endpoint = new URL(request.url).origin + new URL(request.url).pathname;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ciência eletrônica | TCS</title><style>
  :root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f5f7fb}.shell{max-width:760px;margin:0 auto;padding:24px 16px 48px}.brand{color:#0f766e;font-size:13px;font-weight:800;letter-spacing:.08em}.card{background:#fff;border:1px solid #dbe3ef;border-radius:16px;padding:20px;margin-top:16px;box-shadow:0 8px 24px #1720330b}h1{font-size:25px;margin:8px 0}h2{font-size:18px;margin:0 0 12px}p{line-height:1.5;color:#526174}.muted{font-size:13px}.hidden{display:none!important}iframe{width:100%;height:460px;border:1px solid #dbe3ef;border-radius:12px;margin-top:12px}label{font-size:13px;font-weight:700;display:block;margin:14px 0 6px}input,select,textarea{box-sizing:border-box;width:100%;border:1px solid #b9c5d5;border-radius:10px;padding:12px;font:inherit;background:#fff}textarea{min-height:84px}button{border:0;border-radius:10px;padding:13px 16px;font:inherit;font-weight:800;cursor:pointer;background:#0f766e;color:#fff;width:100%;margin-top:16px}button:disabled{opacity:.55;cursor:wait}.choices{display:flex;gap:8px}.choice{background:#eef2f7;color:#26354b;margin:0}.choice.active{background:#d7f3ed;color:#075e54}.canvas{width:100%;height:170px;border:1px solid #b9c5d5;border-radius:10px;touch-action:none;background:#fff}.notice{display:flex;gap:8px;align-items:flex-start;font-size:13px}.error{color:#b42318;background:#fff1f0}.success{color:#087443;background:#ecfdf3}</style></head><body><main class="shell"><div class="brand">TCS · DEFESA CIVIL</div><h1>Ciência eletrônica</h1><p id="loading">Carregando documento seguro…</p><section id="content" class="hidden"><div class="card"><h2 id="title">Documento</h2><p id="metadata" class="muted"></p><iframe id="pdf" title="Documento apresentado"></iframe></div><form id="form" class="card"><h2>Registrar recebimento</h2><p class="muted">Leia o documento antes de registrar sua ciência. O link expira e só pode ser usado uma vez.</p><label>Resultado da apresentação</label><div class="choices"><button type="button" class="choice active" data-outcome="acknowledged">Ciente</button><button type="button" class="choice" data-outcome="refused">Recusa</button><button type="button" class="choice" data-outcome="unable_to_sign">Impossibilidade</button></div><label for="name">Nome do destinatário</label><input id="name" required autocomplete="name"><label for="relationship">Relação com o atendimento</label><input id="relationship" required value="Morador ou responsável"><div id="ack"><label class="notice"><input id="declaration" type="checkbox" style="width:auto">Declaro que tive acesso ao documento apresentado, recebi as orientações nele registradas e estou ciente de seu conteúdo. Esta ciência registra o recebimento e não substitui assinatura digital qualificada.</label><label>Assinatura manuscrita</label><canvas id="canvas" class="canvas"></canvas><button type="button" id="clear" class="choice">Limpar assinatura</button></div><div id="reasonWrap" class="hidden"><label for="reason">Motivo</label><textarea id="reason" placeholder="Descreva a recusa ou impossibilidade"></textarea></div><button id="submit" type="submit">Registrar ciência</button></form></section><div id="message" class="card hidden"></div></main><script>
  const endpoint=${JSON.stringify(endpoint)}, anonKey=${JSON.stringify(anonKey)}, token=new URLSearchParams(location.search).get('t')||'';
  const declaration='Declaro que tive acesso ao documento apresentado, recebi as orientações nele registradas e estou ciente de seu conteúdo. Esta ciência registra o recebimento e não substitui assinatura digital qualificada.';
  let outcome='acknowledged', strokes=[], active=null; const $=id=>document.getElementById(id); const msg=(text,kind='error')=>{$('loading').classList.add('hidden');$('message').className='card '+kind;$('message').textContent=text};
  async function call(body){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','apikey':anonKey},body:JSON.stringify({...body,token})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||'Não foi possível concluir a operação.');return j}
  function resize(){const c=$('canvas'),rect=c.getBoundingClientRect(),ratio=devicePixelRatio||1;c.width=rect.width*ratio;c.height=rect.height*ratio;draw()}; function draw(){const c=$('canvas'),x=c.getContext('2d'),r=c.getBoundingClientRect(),q=devicePixelRatio||1;x.setTransform(q,0,0,q,0,0);x.clearRect(0,0,r.width,r.height);x.strokeStyle='#172033';x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';strokes.forEach(s=>{x.beginPath();s.points.forEach((p,i)=>i?x.lineTo(p.x*r.width,p.y*r.height):x.moveTo(p.x*r.width,p.y*r.height));x.stroke()})}; function point(e){const r=$('canvas').getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}};
  $('canvas').addEventListener('pointerdown',e=>{e.preventDefault();$('canvas').setPointerCapture(e.pointerId);active={points:[point(e)]};strokes.push(active);draw()});$('canvas').addEventListener('pointermove',e=>{if(!active)return;active.points.push(point(e));draw()});['pointerup','pointercancel'].forEach(ev=>$('canvas').addEventListener(ev,()=>active=null));$('clear').onclick=()=>{strokes=[];draw()};
  document.querySelectorAll('[data-outcome]').forEach(b=>b.onclick=()=>{outcome=b.dataset.outcome;document.querySelectorAll('[data-outcome]').forEach(x=>x.classList.toggle('active',x===b));$('ack').classList.toggle('hidden',outcome!=='acknowledged');$('reasonWrap').classList.toggle('hidden',outcome==='acknowledged')});
  $('form').onsubmit=async e=>{e.preventDefault();if(outcome==='acknowledged'&&(!$('declaration').checked||!strokes.length)){msg('Leia e aceite a declaração e faça a assinatura antes de continuar.');return}if(outcome!=='acknowledged'&&$('reason').value.trim().length<3){msg('Informe o motivo para continuar.');return}$('submit').disabled=true;try{const res=await call({action:'sign',outcome,recipient_name:$('name').value,recipient_relationship:$('relationship').value,declaration_version:'tcs-ack-v1',declaration_text:declaration,signature_strokes:outcome==='acknowledged'?strokes:null,reason:outcome==='acknowledged'?null:$('reason').value});$('content').classList.add('hidden');msg('Registro concluído. Protocolo: '+res.result.protocol,'success')}catch(e){msg(e.message)}finally{$('submit').disabled=false}};
  (async()=>{try{const data=await call({action:'view'});$('title').textContent=data.document.type==='interdiction_term'?'Termo de interdição':'Relatório de vistoria';$('metadata').textContent=[data.document.protocol,data.document.address].filter(Boolean).join(' · ');$('pdf').src=data.signed_url;$('loading').classList.add('hidden');$('content').classList.remove('hidden');resize();addEventListener('resize',resize)}catch(e){msg(e.message==='link_expired'?'Este link expirou. Solicite um novo ao agente responsável.':'Este link não está disponível.')}})();
  </script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

Deno.serve(async (request) => {
  if (request.method === 'GET') return linkPage(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const token = typeof body.token === 'string' ? body.token.toLowerCase() : '';
  const linkRequest = await getRequest(token);
  const unavailable = availabilityError(linkRequest);
  if (unavailable) return json({ ok: false, error: unavailable }, unavailable === 'link_expired' ? 410 : 404);
  const document = linkRequest!.generated_documents!;

  if (body.action === 'view') {
    const { data: signed, error } = await admin.storage.from('document-evidence').createSignedUrl(document.storage_path, 300);
    if (error || !signed?.signedUrl) return json({ ok: false, error: 'document_signing_failed' }, 502);
    const payload = document.content_snapshot?.payload as Record<string, unknown> | undefined;
    return json({
      ok: true,
      document: {
        type: document.document_type,
        protocol: typeof payload?.protocolo === 'string' ? payload.protocolo : null,
        address: typeof payload?.endereco === 'string' ? payload.endereco : null,
      },
      expires_at: linkRequest!.expires_at,
      signed_url: signed.signedUrl,
    });
  }

  if (body.action !== 'sign') return json({ ok: false, error: 'invalid_action' }, 400);
  const outcome = body.outcome;
  const recipientName = typeof body.recipient_name === 'string' ? body.recipient_name.trim() : '';
  const relationship = typeof body.recipient_relationship === 'string' ? body.recipient_relationship.trim() : '';
  const declarationText = typeof body.declaration_text === 'string' ? body.declaration_text.trim() : '';
  const declarationVersion = typeof body.declaration_version === 'string' ? body.declaration_version.trim() : '';
  const signature = body.signature_strokes;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!['acknowledged', 'refused', 'unable_to_sign'].includes(String(outcome)) || recipientName.length < 2 || relationship.length < 2 || declarationText.length < 20 || !declarationVersion) {
    return json({ ok: false, error: 'invalid_acknowledgement_payload' }, 422);
  }
  if (outcome === 'acknowledged' && !isSignature(signature)) return json({ ok: false, error: 'signature_required' }, 422);
  if (outcome !== 'acknowledged' && reason.length < 3) return json({ ok: false, error: 'reason_required' }, 422);

  const tokenHash = await sha256(token);
  const declarationHash = await sha256(canonicalize({ text: declarationText, version: declarationVersion }));
  let signatureStoragePath: string | null = null;
  let signatureHash: string | null = null;
  if (outcome === 'acknowledged') {
    signatureHash = await sha256(canonicalize(signature));
    signatureStoragePath = `${document.owner_user_id}/${document.vistoria_id}/${document.id}/remote-signatures/${linkRequest!.id}.json`;
    const { error } = await admin.storage.from('document-evidence').upload(
      signatureStoragePath,
      new TextEncoder().encode(canonicalize(signature)),
      { contentType: 'application/json', upsert: true },
    );
    if (error) return json({ ok: false, error: 'signature_upload_failed' }, 502);
  }
  const { data, error } = await admin.rpc('finalize_remote_document_acknowledgement', {
    p_token_hash: tokenHash,
    p_payload: {
      outcome,
      declaration_version: declarationVersion,
      declaration_text: declarationText,
      declaration_hash: declarationHash,
      recipient_name: recipientName,
      recipient_relationship: relationship,
      signature_strokes: outcome === 'acknowledged' ? signature : null,
      signature_hash: signatureHash,
      signature_storage_path: signatureStoragePath,
      reason: outcome === 'acknowledged' ? null : reason,
    },
  });
  if (error) {
    const status = /link_expired/i.test(error.message) ? 410 : /already|unavailable/i.test(error.message) ? 409 : 422;
    return json({ ok: false, error: error.message || 'acknowledgement_failed' }, status);
  }
  return json({ ok: true, result: data });
});
