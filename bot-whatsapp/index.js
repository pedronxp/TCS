// TCS — Bot WhatsApp externo (multi-sessão, componente opcional e isolado).
//
// Decisão e riscos: docs/decisions/bot-whatsapp-externo.md. Cada número
// vinculado pertence a UMA organização (criado pelo portal municipal) — o
// número da conta individual de alguém nunca enxerga comunidades de outro
// município. O disparo tenta, em sequência, todos os números vinculados da
// prefeitura que enxergam o chat da comunidade (fallback: um caiu, o outro envia).
//
// O que ele faz:
//   1. Detecta sessões criadas no painel (bot_sessoes 'aguardando_qr') e serve
//      um QR por número em http://localhost:PORT/sessao/<id>.
//   2. Vinculado, sincroniza os grupos que o número enxerga para bot_chats.
//   3. Consome a fila canal_envios 'pendente' com fallback entre sessões.
//
// Segredos: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY e CHROME_PATH existem SOMENTE
// no .env deste ambiente (fora do git).

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');

// Carrega ./.env (KEY=VALUE por linha) se existir.
(function carregarEnvLocal() {
  const arquivo = path.join(__dirname, '.env');
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const separador = limpa.indexOf('=');
    if (separador <= 0) continue;
    const chave = limpa.slice(0, separador).trim();
    if (!(chave in process.env)) process.env[chave] = limpa.slice(separador + 1).trim();
  }
})();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = Number(process.env.PORT || 8787);
const POLL_MS = Number(process.env.POLL_MS || 5000);
const CHAT_SYNC_MS = Number(process.env.CHAT_SYNC_MS || 10 * 60 * 1000);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[bot] Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.');
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

function log(escopo, mensagem, erro) {
  const linha = `[bot][${escopo}] ${mensagem}`;
  if (erro) console.error(linha, erro instanceof Error ? erro.message : erro);
  else console.log(linha);
}

function agoraIso() {
  return new Date().toISOString();
}

// id -> { id, orgId, orgNome, client, fase, qr, qrGeradoEm, telefone, ultimoErro }
const sessoes = new Map();

function textoComunicado(comunicado, organizacao) {
  return [
    `*${comunicado.titulo}*`,
    `_${SEVERIDADE_LABEL[comunicado.severidade] || 'Informação'}_`,
    '',
    comunicado.conteudo,
    '',
    `— ${organizacao || 'Prefeitura'} · via TCS`,
  ].join('\n');
}

async function atualizarSessaoDb(id, campos) {
  const { error } = await supabase.from('bot_sessoes').update(campos).eq('id', id);
  if (error) log('db', `Falha ao atualizar sessao ${id}`, error);
}

async function sincronizarChats(sessao) {
  try {
    const chats = await sessao.client.getChats();
    const grupos = chats.filter((chat) => chat.isGroup);
    for (const grupo of grupos) {
      let totalAdmins = 0;
      let totalParticipantes = 0;
      try {
        const participantes = grupo.participants || [];
        totalParticipantes = participantes.length;
        totalAdmins = participantes.filter((p) => p.isAdmin || p.isSuperAdmin).length;
      } catch (_erroParticipantes) { /* versões antigas não expõem participantes */ }
      await supabase
        .from('bot_chats')
        .upsert(
          {
            sessao_id: sessao.id,
            chat_id: grupo.id._serialized,
            nome: grupo.name || grupo.id._serialized,
            tipo: 'grupo',
            total_admins: totalAdmins,
            total_participantes: totalParticipantes,
            visto_em: agoraIso(),
          },
          { onConflict: 'sessao_id,chat_id' },
        );
    }
    log('chats', `${sessao.orgNome} · ${sessao.telefone || sessao.id.slice(0, 8)}: ${grupos.length} grupos sincronizados`);
  } catch (erro) {
    log('chats', `Falha ao sincronizar chats da sessao ${sessao.id}`, erro);
  }
}

function iniciarSessao(linha) {
  if (sessoes.has(linha.id)) return;
  const sessao = {
    id: linha.id,
    orgId: linha.organization_id,
    orgNome: linha.org_nome || 'Prefeitura',
    client: null,
    fase: 'iniciando',
    qr: null,
    qrGeradoEm: null,
    telefone: linha.telefone || null,
    ultimoErro: null,
  };
  sessoes.set(linha.id, sessao);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessao', clientId: linha.id }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    },
  });
  sessao.client = client;

  client.on('qr', (qr) => {
    sessao.fase = 'aguardando_qr';
    sessao.qr = qr;
    sessao.qrGeradoEm = new Date();
    log('sessao', `${sessao.orgNome}: QR gerado às ${sessao.qrGeradoEm.toLocaleTimeString('pt-BR')} — /sessao/${sessao.id}`);
  });

  client.on('authenticated', () => {
    sessao.ultimoErro = null;
    log('sessao', `${sessao.orgNome}: QR aceito — autenticando…`);
  });

  client.on('auth_failure', (motivo) => {
    sessao.ultimoErro = String(motivo || 'falha de autenticação');
    log('sessao', `${sessao.orgNome}: falha de autenticação — escaneie o novo QR`, motivo);
  });

  client.on('ready', async () => {
    sessao.fase = 'vinculado';
    sessao.qr = null;
    try {
      sessao.telefone = client.info && client.info.wid ? client.info.wid.user : sessao.telefone;
    } catch (_erro) { /* número fica para a próxima sincronização */ }
    log('sessao', `${sessao.orgNome}: conta vinculada${sessao.telefone ? ` (${sessao.telefone})` : ''}`);
    await atualizarSessaoDb(sessao.id, {
      status: 'vinculado',
      telefone: sessao.telefone,
      vinculado_em: agoraIso(),
      atualizado_em: agoraIso(),
    });
    await sincronizarChats(sessao);
  });

  client.on('disconnected', async (motivo) => {
    sessao.fase = 'reconectando';
    sessao.ultimoErro = String(motivo || 'desconectado');
    log('sessao', `${sessao.orgNome}: sessão caiu${sessao.telefone ? ` (${sessao.telefone})` : ''}`, motivo);
    await atualizarSessaoDb(sessao.id, { status: 'desconectado', atualizado_em: agoraIso() });
  });

  client.initialize().catch((erro) => {
    sessao.ultimoErro = String((erro && erro.message) || erro);
    log('startup', `Falha ao inicializar sessao ${sessao.id}`, erro);
  });
}

async function pararSessao(id) {
  const sessao = sessoes.get(id);
  if (!sessao) return;
  try {
    await sessao.client.destroy();
  } catch (_erro) { /* cliente já morto */ }
  sessoes.delete(id);
  log('sessao', `Sessao ${id} encerrada (banida/desativada no painel).`);
}

// Descobre sessões novas no painel, encerra as desativadas e mantém nomes das orgs.
async function gerenciarSessoes() {
  const { data: linhas, error } = await supabase
    .from('bot_sessoes')
    .select('id, organization_id, telefone, status, organizations(display_name)')
    .in('status', ['aguardando_qr', 'vinculado', 'desconectado']);
  if (error) {
    log('db', 'Falha ao listar sessoes', error);
    return;
  }
  const ativas = new Set();
  for (const linha of linhas || []) {
    ativas.add(linha.id);
    const orgNome = linha.organizations && linha.organizations.display_name;
    const existente = sessoes.get(linha.id);
    if (existente) {
      if (orgNome) existente.orgNome = orgNome;
      if (linha.telefone) existente.telefone = linha.telefone;
      if (linha.status === 'desconectado' && existente.fase === 'vinculado') {
        existente.fase = 'reconectando'; // aguarda reconexão automática do client
      }
    } else {
      iniciarSessao({ ...linha, org_nome: orgNome });
    }
  }
  for (const id of [...sessoes.keys()]) {
    if (!ativas.has(id)) await pararSessao(id);
  }
}

// Sessões prontas de uma organização que enxergam o chat (fallback em sequência).
async function candidatosDoChat(orgId, chatId) {
  const { data, error } = await supabase
    .from('bot_chats')
    .select('sessao_id, bot_sessoes(telefone, organization_id, status, atualizado_em)')
    .eq('chat_id', chatId)
    .neq('bot_sessoes.status', 'banido');
  if (error || !data) return [];
  return data
    .filter((item) => {
      const s = item.bot_sessoes;
      return s && s.organization_id === orgId && s.status === 'vinculado';
    })
    .sort((a, b) => String(b.bot_sessoes.atualizado_em).localeCompare(String(a.bot_sessoes.atualizado_em)))
    .map((item) => ({ sessaoId: item.sessao_id, telefone: item.bot_sessoes.telefone || 'sem número' }));
}

async function processarFila() {
  const { data: pendentes, error } = await supabase
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
    const { data: canal } = await supabase
      .from('canais_externos')
      .select('id, nome, chat_id, organization_id')
      .eq('id', item.canal_id)
      .maybeSingle();
    if (!canal || !canal.chat_id) {
      await finalizarEnvio(item.id, null, 'falhou', 'Comunidade sem chat vinculado no painel.', []);
      continue;
    }
    const { data: comunicado } = await supabase
      .from('comunicados')
      .select('titulo, conteudo, severidade, status')
      .eq('id', item.comunicado_id)
      .maybeSingle();
    if (!comunicado || !['publicado', 'arquivado'].includes(comunicado.status)) {
      await finalizarEnvio(item.id, null, 'falhou', 'Comunicado não está publicado.', []);
      continue;
    }
    const { data: org } = await supabase
      .from('organizations')
      .select('display_name')
      .eq('id', canal.organization_id)
      .maybeSingle();

    const candidatos = await candidatosDoChat(canal.organization_id, canal.chat_id);
    if (candidatos.length === 0) {
      await finalizarEnvio(item.id, null, 'falhou', 'Nenhum número vinculado desta prefeitura enxerga o chat da comunidade.', []);
      continue;
    }

    const texto = textoComunicado(comunicado, org && org.display_name);
    const tentativas = [];
    let sucesso = null;
    for (const candidato of candidatos) {
      const sessao = sessoes.get(candidato.sessaoId);
      if (!sessao || sessao.fase !== 'vinculado') {
        tentativas.push({ telefone: candidato.telefone, erro: 'sessão não está conectada agora' });
        continue;
      }
      try {
        await sessao.client.sendMessage(canal.chat_id, texto);
        sucesso = candidato;
        break;
      } catch (erro) {
        const mensagem = String((erro && erro.message) || erro).slice(0, 200);
        tentativas.push({ telefone: candidato.telefone, erro: mensagem });
        log('envio', `Falha com ${candidato.telefone} em "${canal.nome}"`, erro);
      }
    }

    if (sucesso) {
      await finalizarEnvio(item.id, sucesso.sessaoId, 'enviado', null, tentativas);
      log('envio', `Enviado em "${canal.nome}" pelo número ${sucesso.telefone}${tentativas.length ? ` (após ${tentativas.length} falha${tentativas.length === 1 ? '' : 's'})` : ''}`);
    } else {
      await finalizarEnvio(item.id, null, 'falhou', tentativas.map((t) => `${t.telefone}: ${t.erro}`).join(' | ').slice(0, 500), tentativas);
    }
  }
}

async function finalizarEnvio(envioId, sessaoId, status, erro, tentativas) {
  const { error } = await supabase
    .from('canal_envios')
    .update({
      status,
      sessao_id: sessaoId,
      erro: erro || null,
      tentativas: tentativas && tentativas.length ? tentativas : null,
      enviado_em: status === 'enviado' ? agoraIso() : null,
      bot_atualizado_em: agoraIso(),
    })
    .eq('id', envioId);
  if (error) log('db', `Falha ao finalizar envio ${envioId}`, error);
}

// ---------------------------------------------------------------------------
// HTTP: lista de números + QR por sessão.
// ---------------------------------------------------------------------------

const app = express();

function paginaQr(sessao) {
  const pronto = sessao.fase === 'vinculado';
  const hora = sessao.qrGeradoEm ? sessao.qrGeradoEm.toLocaleTimeString('pt-BR') : '—';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TCS — Vincular número · ${sessao.orgNome}</title>
<meta http-equiv="refresh" content="5">
<style>
  body{font-family:system-ui,sans-serif;background:#0b1120;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#111a2e;border:1px solid #1e293b;border-radius:16px;padding:32px;max-width:420px;text-align:center}
  h1{font-size:18px;margin:0 0 8px}
  p{font-size:13px;color:#94a3b8;margin:6px 0}
  img{border-radius:12px;background:#fff;padding:8px;margin:16px 0}
  .ok{color:#4ade80;font-weight:600}
  .erro{color:#f87171}
  a{color:#7dd3fc}
</style></head><body><div class="card">
<h1>TCS — Vincular número</h1>
<p>Prefeitura: <b>${sessao.orgNome}</b></p>
<p>Estado: <b>${sessao.fase}</b>${sessao.telefone ? ` · ${sessao.telefone}` : ''}</p>
${pronto ? '<p class="ok">Conta vinculada. Este número já pode disparar para as comunidades da prefeitura.</p>' : ''}
${sessao.ultimoErro ? `<p class="erro">Último erro: ${sessao.ultimoErro}</p>` : ''}
${sessao.qr ? `<img src="/qr/${sessao.id}" alt="QR Code do WhatsApp"><p>QR gerado às <b>${hora}</b> — escaneie em até 20 segundos; a página renova sozinha.</p><p>Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho — com o celular do número desta prefeitura.</p>` : '<p>Aguardando QR Code…</p>'}
<p style="margin-top:16px"><a href="/">← todos os números</a></p>
</div></body></html>`;
}

// O painel do console embute o QR e consulta o status direto daqui; CORS
// liberado apenas para leitura dos endpoints de status/QR.
app.use('/healthz', (_req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
app.use('/status', (_req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
app.use('/sessao', (_req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
app.use('/qr', (_req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, sessoes: sessoes.size });
});

app.get('/status', (_req, res) => {
  res.json({
    sessoes: [...sessoes.values()].map((s) => ({
      id: s.id, orgNome: s.orgNome, fase: s.fase, telefone: s.telefone, ultimoErro: s.ultimoErro,
    })),
  });
});

// Status de UMA sessão — o painel consulta durante o pareamento do QR.
app.get('/sessao/:id/status', (req, res) => {
  const sessao = sessoes.get(req.params.id);
  if (!sessao) {
    res.status(404).json({ fase: 'nao_encontrada', telefone: null, ultimoErro: 'Sessão não encontrada no bot — gere o QR novamente no painel.' });
    return;
  }
  res.json({
    fase: sessao.fase,
    telefone: sessao.telefone,
    qrPresente: Boolean(sessao.qr),
    qrGeradoEm: sessao.qrGeradoEm ? sessao.qrGeradoEm.toISOString() : null,
    ultimoErro: sessao.ultimoErro,
  });
});

app.get('/qr/:id', async (req, res) => {
  const sessao = sessoes.get(req.params.id);
  if (!sessao || !sessao.qr) {
    res.status(404).type('text').send('QR indisponível');
    return;
  }
  try {
    const dataUrl = await QRCode.toDataURL(sessao.qr, { margin: 1, width: 320 });
    res.type('img/png');
    const base64 = dataUrl.split(',')[1];
    res.end(Buffer.from(base64, 'base64'));
  } catch (erro) {
    res.status(500).type('text').send('falha ao gerar QR');
  }
});

app.get('/sessao/:id', (req, res) => {
  const sessao = sessoes.get(req.params.id);
  if (!sessao) {
    res.status(404).type('html').send('<p>Sessão não encontrada ou encerrada. Volte ao painel e vincule o número novamente.</p><a href="/">todos os números</a>');
    return;
  }
  res.type('html').send(paginaQr(sessao));
});

app.get('/', (_req, res) => {
  const linhas = [...sessoes.values()].map((s) => `
    <tr>
      <td>${s.orgNome}</td>
      <td>${s.telefone || '—'}</td>
      <td>${s.fase}${s.ultimoErro ? ` <span class="erro">(${s.ultimoErro.slice(0, 60)})</span>` : ''}</td>
      <td>${s.fase === 'vinculado' ? '✅' : `<a href="/sessao/${s.id}">abrir QR</a>`}</td>
    </tr>`).join('');
  const corpo = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TCS — Números do bot</title>
<meta http-equiv="refresh" content="10">
<style>
  body{font-family:system-ui,sans-serif;background:#0b1120;color:#e2e8f0;margin:0;padding:32px}
  h1{font-size:18px}
  table{border-collapse:collapse;width:100%;max-width:720px;background:#111a2e;border:1px solid #1e293b;border-radius:12px}
  th,td{padding:10px 14px;text-align:left;font-size:13px;border-bottom:1px solid #1e293b}
  .erro{color:#f87171}
  a{color:#7dd3fc}
  p{font-size:13px;color:#94a3b8}
</style></head><body>
<h1>TCS — Números vinculados ao bot</h1>
<p>Números são vinculados no painel do portal municipal (Comunicados → Números do bot). Número banido: marque como banido no painel e vincule outro.</p>
<table><tr><th>Prefeitura</th><th>Número</th><th>Estado</th><th>QR</th></tr>${linhas || '<tr><td colspan="4">Nenhum número emparelhando — comece pelo painel.</td></tr>'}</table>
</body></html>`;
  res.type('html').send(corpo);
});

// Ciclos: descobrir/encerrar sessões, consumir fila, sincronizar chats.
setInterval(() => {
  gerenciarSessoes().catch((erro) => log('sessoes', 'Erro no ciclo de sessões', erro));
}, POLL_MS);

setInterval(() => {
  processarFila().catch((erro) => log('fila', 'Erro no ciclo da fila', erro));
}, POLL_MS);

setInterval(() => {
  for (const sessao of sessoes.values()) {
    if (sessao.fase === 'vinculado') {
      sincronizarChats(sessao).catch(() => null);
    }
  }
}, CHAT_SYNC_MS);

app.listen(PORT, () => {
  log('http', `Painel do bot em http://localhost:${PORT} (números e QR por sessão)`);
});
