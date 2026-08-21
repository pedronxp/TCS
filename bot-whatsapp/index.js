// TCS — Bot WhatsApp externo (componente opcional e isolado).
//
// Decisão e riscos: docs/decisions/bot-whatsapp-externo.md. O dono do produto
// assumiu o risco de banimento do número vinculado ("cai, vincula outro").
// Este serviço NÃO faz parte do core: o TCS continua funcionando sem ele e o
// disparo assistido (copiar/abrir/colar) permanece como contingência.
//
// O que ele faz:
//   1. Serve uma tela com QR Code (http://localhost:PORT/) para vincular a
//      conta WhatsApp que vai disparar (sessão persistida em ./sessao).
//   2. Sincroniza os grupos/grupos de anúncios descobertos para bot_chats,
//      que o painel usa para vincular comunidade -> chat.
//   3. Consome a fila canal_envios (status 'pendente') no Supabase e envia o
//      comunicado, gravando 'enviado' ou 'falhou' com erro.
//
// Segredos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY existem SOMENTE aqui,
// no ambiente onde o bot roda. Nunca commitadas, nunca no app/painel.

const express = require('express');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = Number(process.env.PORT || 8787);
const POLL_MS = Number(process.env.POLL_MS || 5000);
const CHAT_SYNC_MS = Number(process.env.CHAT_SYNC_MS || 10 * 60 * 1000);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[bot] Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SEVERIDADE_LABEL = {
  informacao: 'Informação',
  alerta: 'Alerta',
  emergencia: 'Emergência',
};

const estado = {
  fase: 'iniciando', // iniciando | aguardando_qr | vinculado | reconectando
  qrDataUrl: null,
  numero: null,
  ultimoErro: null,
};

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './sessao' }),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

function log(escopo, mensagem, erro) {
  const linha = `[bot][${escopo}] ${mensagem}`;
  if (erro) console.error(linha, erro);
  else console.log(linha);
}

function textoComunicado(comunicado, organizacao) {
  const linhas = [
    `*${comunicado.titulo}*`,
    `_${SEVERIDADE_LABEL[comunicado.severidade] || 'Informação'}_`,
    '',
    comunicado.conteudo,
    '',
    `— ${organizacao || 'Prefeitura'} · via TCS`,
  ];
  return linhas.join('\n');
}

client.on('qr', async (qr) => {
  estado.fase = 'aguardando_qr';
  estado.numero = null;
  try {
    estado.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
    log('sessao', 'QR Code gerado — escaneie em http://localhost:' + PORT);
  } catch (erro) {
    estado.qrDataUrl = null;
    log('sessao', 'Falha ao gerar imagem do QR', erro);
  }
});

client.on('ready', async () => {
  estado.fase = 'vinculado';
  estado.qrDataUrl = null;
  estado.ultimoErro = null;
  try {
    const me = client.info && client.info.wid ? client.info.wid.user : null;
    estado.numero = me;
    log('sessao', 'Conta vinculada' + (me ? ` (${me})` : ''));
  } catch (erro) {
    log('sessao', 'Conta vinculada (número indisponível)', erro);
  }
  await sincronizarChats();
});

client.on('disconnected', (motivo) => {
  estado.fase = 'reconectando';
  estado.numero = null;
  estado.ultimoErro = String(motivo || 'desconectado');
  log('sessao', 'Sessão caiu — se o número foi banido, apague ./sessao e re-escaneie com outro número.', motivo);
});

async function sincronizarChats() {
  try {
    const chats = await client.getChats();
    const grupos = chats.filter((chat) => chat.isGroup);
    for (const grupo of grupos) {
      await supabase
        .from('bot_chats')
        .upsert(
          { chat_id: grupo.id._serialized, nome: grupo.name || grupo.id._serialized, tipo: 'grupo', visto_em: new Date().toISOString() },
          { onConflict: 'chat_id' },
        );
    }
    log('chats', `${grupos.length} grupos sincronizados para bot_chats`);
  } catch (erro) {
    log('chats', 'Falha ao sincronizar chats', erro);
  }
}

async function processarFila() {
  if (estado.fase !== 'vinculado') return;
  let { data: pendentes, error } = await supabase
    .from('canal_envios')
    .select('id, canal_id, comunicado_id')
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) {
    log('fila', 'Falha ao consultar fila', error);
    return;
  }
  for (const item of pendentes || []) {
    try {
      const { data: canal } = await supabase
        .from('canais_externos')
        .select('id, nome, chat_id, organization_id')
        .eq('id', item.canal_id)
        .maybeSingle();
      if (!canal || !canal.chat_id) {
        await finalizarEnvio(item.id, 'falhou', 'Comunidade sem chat vinculado no painel.');
        continue;
      }
      const { data: comunicado } = await supabase
        .from('comunicados')
        .select('titulo, conteudo, severidade, status')
        .eq('id', item.comunicado_id)
        .maybeSingle();
      if (!comunicado || !['publicado', 'arquivado'].includes(comunicado.status)) {
        await finalizarEnvio(item.id, 'falhou', 'Comunicado não está publicado.');
        continue;
      }
      const { data: org } = await supabase
        .from('organizations')
        .select('display_name')
        .eq('id', canal.organization_id)
        .maybeSingle();

      const texto = textoComunicado(comunicado, org && org.display_name);
      await client.sendMessage(canal.chat_id, texto);
      await finalizarEnvio(item.id, 'enviado', null);
      log('envio', `Enviado para "${canal.nome}" (${canal.chat_id})`);
    } catch (erro) {
      await finalizarEnvio(item.id, 'falhou', String((erro && erro.message) || erro).slice(0, 300));
      log('envio', 'Falha no disparo', erro);
    }
  }
}

async function finalizarEnvio(envioId, status, erro) {
  await supabase
    .from('canal_envios')
    .update({
      status,
      erro: erro || null,
      enviado_em: status === 'enviado' ? new Date().toISOString() : null,
      bot_atualizado_em: new Date().toISOString(),
    })
    .eq('id', envioId);
}

const app = express();

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, fase: estado.fase });
});

app.get('/status', (_req, res) => {
  res.json({ fase: estado.fase, numero: estado.numero, ultimoErro: estado.ultimoErro });
});

app.get('/', (_req, res) => {
  const pronto = estado.fase === 'vinculado';
  const corpo = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TCS — Bot WhatsApp</title>
<meta http-equiv="refresh" content="5">
<style>
  body{font-family:system-ui,sans-serif;background:#0b1120;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#111a2e;border:1px solid #1e293b;border-radius:16px;padding:32px;max-width:420px;text-align:center}
  h1{font-size:18px;margin:0 0 8px}
  p{font-size:13px;color:#94a3b8;margin:6px 0}
  img{border-radius:12px;background:#fff;padding:8px;margin:16px 0}
  .ok{color:#4ade80;font-weight:600}
  .erro{color:#f87171}
</style></head><body><div class="card">
<h1>TCS — Bot WhatsApp</h1>
<p>Estado: <b>${estado.fase}</b>${estado.numero ? ` · ${estado.numero}` : ''}</p>
${pronto ? '<p class="ok">Conta vinculada. A fila de disparo está ativa.</p>' : ''}
${estado.ultimoErro ? `<p class="erro">Último erro: ${estado.ultimoErro}</p>` : ''}
${estado.qrDataUrl ? `<img src="${estado.qrDataUrl}" alt="QR Code do WhatsApp"><p>Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho e escaneie.</p>` : '<p>Aguardando QR Code…</p>'}
<p style="margin-top:16px">Número banido? Apague a pasta <code>./sessao</code> e recarregue com outro número.</p>
</div></body></html>`;
  res.type('html').send(corpo);
});

client.initialize().catch((erro) => {
  estado.ultimoErro = String((erro && erro.message) || erro);
  log('startup', 'Falha ao inicializar o cliente', erro);
});

setInterval(() => {
  processarFila().catch((erro) => log('fila', 'Erro no ciclo da fila', erro));
}, POLL_MS);

setInterval(() => {
  if (estado.fase === 'vinculado') {
    sincronizarChats().catch(() => null);
  }
}, CHAT_SYNC_MS);

app.listen(PORT, () => {
  log('http', `Painel do bot em http://localhost:${PORT} (QR Code e status)`);
});
