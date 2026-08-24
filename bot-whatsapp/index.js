// TCS — Bot WhatsApp externo (multi-sessão, Baileys, sem navegador).
//
// Decisão e riscos: docs/decisions/bot-whatsapp-externo.md. Cada número
// pertence a UMA organização; o disparo tenta todos os números da prefeitura
// que enxergam o chat (fallback). Migramos do whatsapp-web.js (que depende da
// página web e quebrou com a atualização do WhatsApp Web) para o Baileys,
// que fala o protocolo direto — sem Chrome, sem injeção na página.
//
// Contratos HTTP mantidos: /healthz, /status, /sessao/:id/status, /verify,
// /criar-grupo, /sincronizar, /qr/:id e a página de QR por sessão.

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const { useSupabaseAuthState } = require('./supabase-auth-state');
const { sameOrganization } = require('./organization-isolation');

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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SESSION_ENCRYPTION_KEY = process.env.BOT_SESSION_ENCRYPTION_KEY;
const PORT = Number(process.env.PORT || 8787);
const POLL_MS = Number(process.env.POLL_MS || 5000);
const CHAT_SYNC_MS = Number(process.env.CHAT_SYNC_MS || 10 * 60 * 1000);
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 20_000);
const DASHBOARD_ORIGINS = new Set((process.env.DASHBOARD_ORIGIN
  || 'https://tcsvisto.netlify.app,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean));
const WORKER_ID = process.env.RENDER_INSTANCE_ID || `bot-${process.pid}-${Date.now().toString(36)}`;
const BOT_VERSION = (process.env.RENDER_GIT_COMMIT || process.env.npm_package_version || 'local').slice(0, 80);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BOT_SESSION_ENCRYPTION_KEY) {
  console.error('[bot] Configure SUPABASE_URL, SUPABASE_SECRET_KEY e BOT_SESSION_ENCRYPTION_KEY.');
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
  if (erro) console.error(linha, erro instanceof Error ? `${erro.message} | ${erro.stack || ''}`.slice(0, 400) : JSON.stringify(erro).slice(0, 400));
  else console.log(linha);
}

function agoraIso() {
  return new Date().toISOString();
}

// id -> { id, orgId, orgNome, socket, fase, qr, qrGeradoEm, telefone, ultimoErro, parar }
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

async function reportarWorker(state = 'online') {
  const { error } = await supabase.rpc('bot_report_worker_heartbeat', {
    p_worker_id: WORKER_ID,
    p_state: state,
    p_version: BOT_VERSION,
  });
  if (error) log('heartbeat', `Falha ao registrar worker ${state}`, error);
}

function runtimeDaFase(fase) {
  if (fase === 'vinculado') return 'online';
  if (fase === 'aguardando_qr') return 'awaiting_qr';
  if (fase === 'reconectando') return 'reconnecting';
  if (fase === 'banido') return 'banned';
  return 'starting';
}

async function reportarSessao(sessao, state = runtimeDaFase(sessao.fase), lastError = sessao.ultimoErro) {
  const { error } = await supabase.rpc('bot_report_session_runtime', {
    p_session_id: sessao.id,
    p_worker_id: WORKER_ID,
    p_state: state,
    p_last_error: lastError || null,
  });
  if (error) log('heartbeat', `Falha ao registrar sessão ${sessao.id} como ${state}`, error);
}

async function sincronizarChats(sessao, tentativa = 1) {
  try {
    const grupos = await sessao.socket.groupFetchAllParticipating();
    const lista = Object.values(grupos || {});
    // Hierarquia Comunidade -> grupos: o protocolo marca o grupo pai (linkedParent).
    const nomes = new Map(lista.map((g) => [g.id, g.subject || g.id]));
    for (const grupo of lista) {
      const participantes = Array.isArray(grupo.participants) ? grupo.participants : [];
      const totalAdmins = participantes.filter((p) => p.admin === 'admin' || p.admin === 'superadmin').length;
      const comunidadeId = grupo.linkedParent || null;
      await supabase
        .from('bot_chats')
        .upsert(
          {
            sessao_id: sessao.id,
            chat_id: grupo.id,
            nome: grupo.subject || grupo.id,
            tipo: 'grupo',
            comunidade_id: comunidadeId,
            comunidade_nome: comunidadeId ? (nomes.get(comunidadeId) || 'Comunidade WhatsApp') : null,
            total_admins: totalAdmins,
            total_participantes: participantes.length,
            visto_em: agoraIso(),
          },
          { onConflict: 'sessao_id,chat_id' },
        );
    }
    const comunidades = new Set(lista.map((g) => g.linkedParent).filter(Boolean));
    log('chats', `${sessao.orgNome} · ${sessao.telefone || sessao.id.slice(0, 8)}: ${lista.length} grupos sincronizados (${comunidades.size} comunidade(s))`);
  } catch (erro) {
    log('chats', `Falha ao sincronizar chats da sessao ${sessao.id} (tentativa ${tentativa})`, erro);
    if (tentativa < 3) {
      setTimeout(() => {
        sincronizarChats(sessao, tentativa + 1).catch(() => null);
      }, 8_000 * tentativa);
    }
  }
}

async function iniciarSessao(linha, tentativaReconexao = 0) {
  const anterior = sessoes.get(linha.id);
  if (anterior && !tentativaReconexao) return;

  const { state, saveCreds, clearState } = await useSupabaseAuthState(
    supabase,
    linha.id,
    BOT_SESSION_ENCRYPTION_KEY,
  );
  const { version } = await fetchLatestBaileysVersion();

  const sessao = {
    id: linha.id,
    orgId: linha.organization_id,
    orgNome: linha.org_nome || 'Prefeitura',
    socket: null,
    fase: state.creds.registered ? 'conectando' : 'aguardando_qr',
    qr: null,
    qrGeradoEm: null,
    telefone: linha.telefone || null,
    ultimoErro: null,
    clearState,
    encerramentoSolicitado: false,
  };
  sessoes.set(linha.id, sessao);
  await reportarSessao(sessao);

  const socket = makeWASocket({
    version,
    auth: state,
    markOnlineOnConnect: false,
    browser: ['TCS Comunicados', 'Chrome', '1.0.0'],
    connectTimeoutMs: 20_000,
  });
  sessao.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (atualizacao) => {
    const { connection, qr, lastDisconnect } = atualizacao;
    if (qr) {
      sessao.fase = 'aguardando_qr';
      sessao.qr = qr;
      sessao.qrGeradoEm = new Date();
      // O QR contém credencial temporária e não deve aparecer nos logs do
      // provedor. A impressão fica disponível apenas para depuração local opt-in.
      if (process.env.PRINT_QR_TERMINAL === 'true') {
        qrcodeTerminal.generate(qr, { small: true }, (codigo) => console.log(codigo));
      }
      log('sessao', `${sessao.orgNome}: QR gerado às ${sessao.qrGeradoEm.toLocaleTimeString('pt-BR')} — painel em /sessao/${sessao.id}`);
      await reportarSessao(sessao, 'awaiting_qr');
    }
    if (connection === 'connecting') {
      sessao.fase = state.creds.registered ? 'conectando' : sessao.fase;
      await reportarSessao(sessao);
    }
    if (connection === 'open') {
      sessao.fase = 'vinculado';
      sessao.qr = null;
      sessao.ultimoErro = null;
      try {
        sessao.telefone = socket.user && socket.user.id ? socket.user.id.split(':')[0].split('@')[0] : sessao.telefone;
      } catch (_erro) { /* mantém telefone anterior */ }
      log('sessao', `${sessao.orgNome}: conta vinculada${sessao.telefone ? ` (${sessao.telefone})` : ''}`);
      await atualizarSessaoDb(sessao.id, {
        status: 'vinculado',
        telefone: sessao.telefone,
        vinculado_em: agoraIso(),
        atualizado_em: agoraIso(),
      });
      await reportarSessao(sessao, 'online', null);
      await sincronizarChats(sessao);
    }
    if (connection === 'close') {
      if (sessao.encerramentoSolicitado) {
        sessoes.delete(sessao.id);
        return;
      }
      const codigo = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
        ? lastDisconnect.error.output.statusCode
        : null;
      const deslogado = codigo === DisconnectReason.loggedOut;
      sessao.fase = deslogado ? 'banido' : 'reconectando';
      sessao.ultimoErro = deslogado
        ? 'Sessão encerrada pelo WhatsApp (número des conectado/banido) — vincule o número novamente.'
        : `desconectado (código ${codigo})`;
      log('sessao', `${sessao.orgNome}: conexão fechada — ${deslogado ? 'deslogado, requer novo QR' : 'vai reconectar'}`);
      await reportarSessao(sessao, deslogado ? 'offline' : 'reconnecting');
      if (deslogado) {
        await atualizarSessaoDb(sessao.id, { status: 'desconectado', atualizado_em: agoraIso() });
        await clearState().catch((erro) => log('sessao', `Falha ao limpar credenciais ${linha.id}`, erro));
        sessoes.delete(sessao.id);
      } else if (tentativaReconexao < 5) {
        setTimeout(() => {
          iniciarSessao(linha, tentativaReconexao + 1).catch((erro) => log('sessao', `Reconexão falhou ${linha.id}`, erro));
        }, 3_000 * (tentativaReconexao + 1));
      }
    }
  });

  return sessao;
}

async function pararSessao(id, { sair = false, runtimeState = 'paused' } = {}) {
  const sessao = sessoes.get(id);
  if (sessao) {
    sessao.encerramentoSolicitado = true;
    await reportarSessao(sessao, runtimeState, runtimeState === 'offline' ? 'Serviço encerrado.' : null);
    try {
      if (sair && sessao.socket && typeof sessao.socket.logout === 'function') {
        await sessao.socket.logout();
      } else if (sessao.socket && typeof sessao.socket.end === 'function') {
        sessao.socket.end(new Error('encerrada pelo painel'));
      }
    } catch (_erro) { /* socket já fechado */ }
    if (sair && typeof sessao.clearState === 'function') {
      await sessao.clearState().catch((erro) => log('sessao', `Falha ao limpar credenciais ${id}`, erro));
    }
    sessoes.delete(id);
  } else if (sair) {
    const auth = await useSupabaseAuthState(supabase, id, BOT_SESSION_ENCRYPTION_KEY);
    await auth.clearState().catch((erro) => log('sessao', `Falha ao limpar credenciais inativas ${id}`, erro));
  }
  log('sessao', `Sessao ${id} ${sair ? 'desvinculada do WhatsApp' : 'desconectada pelo painel'}.`);
}

// Descobre sessões novas no painel, encerra as desativadas e mantém nomes das orgs.
async function gerenciarSessoes() {
  const { data: linhas, error } = await supabase
    .from('bot_sessoes')
    .select('id, organization_id, telefone, status, acao_pendente, organizations(display_name)');
  if (error) {
    log('db', 'Falha ao listar sessoes', error);
    return;
  }
  const ativas = new Set();
  for (const linha of linhas || []) {
    if (linha.acao_pendente === 'sair') {
      await pararSessao(linha.id, { sair: true });
      await atualizarSessaoDb(linha.id, {
        status: 'desconectado',
        acao_pendente: null,
        atualizado_em: agoraIso(),
      });
      continue;
    }
    if (!['aguardando_qr', 'vinculado'].includes(linha.status)) {
      if (sessoes.has(linha.id)) {
        await pararSessao(linha.id, { runtimeState: linha.status === 'banido' ? 'banned' : 'paused' });
      }
      continue;
    }
    ativas.add(linha.id);
    const orgNome = linha.organizations && linha.organizations.display_name;
    const existente = sessoes.get(linha.id);
    if (existente) {
      if (orgNome) existente.orgNome = orgNome;
      if (linha.telefone) existente.telefone = linha.telefone;
    } else {
      iniciarSessao({ ...linha, org_nome: orgNome }).catch((erro) => {
        log('startup', `Falha ao iniciar sessao ${linha.id}`, erro);
      });
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
  const { data: pendentes, error } = await supabase.rpc('bot_claim_pending_deliveries', {
    p_worker_id: WORKER_ID,
    p_limit: 5,
  });
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
      .select('titulo, conteudo, severidade, status, organization_id')
      .eq('id', item.comunicado_id)
      .maybeSingle();
    if (!comunicado || !['publicado', 'arquivado'].includes(comunicado.status)) {
      await finalizarEnvio(item.id, null, 'falhou', 'Comunicado não está publicado.', []);
      continue;
    }
    if (!sameOrganization(canal.organization_id, comunicado.organization_id)) {
      await finalizarEnvio(
        item.id,
        null,
        'falhou',
        'Entrega bloqueada: comunicado e comunidade pertencem a organizações diferentes.',
        [],
      );
      log('seguranca', `Entrega ${item.id} bloqueada por divergencia de organizacao.`);
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
      if (!sessao || sessao.fase !== 'vinculado' || !sameOrganization(canal.organization_id, sessao.orgId)) {
        tentativas.push({ telefone: candidato.telefone, erro: 'sessão não está conectada agora' });
        continue;
      }
      try {
        await sessao.socket.sendMessage(canal.chat_id, { text: texto });
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
      processing_started_at: null,
    })
    .eq('id', envioId)
    .eq('worker_id', WORKER_ID);
  if (error) log('db', `Falha ao finalizar envio ${envioId}`, error);
}

// ---------------------------------------------------------------------------
// HTTP: lista de números + QR por sessão (contrato igual ao anterior).
// ---------------------------------------------------------------------------

const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && DASHBOARD_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') res.sendStatus(204);
  else next();
});

function authorizeSession({ manage = false } = {}) {
  return async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ ok: false, motivo: 'Autenticação necessária.' });
      return;
    }
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authData || !authData.user) {
        res.status(401).json({ ok: false, motivo: 'Sessão do painel inválida.' });
        return;
      }
      const { data: allowed, error: accessError } = await supabase.rpc('bot_authorize_session_access', {
        p_session_id: req.params.id,
        p_user_id: authData.user.id,
        p_manage: manage,
      });
      if (accessError || allowed !== true) {
        res.status(403).json({ ok: false, motivo: 'Acesso negado para esta organização.' });
        return;
      }
      next();
    } catch (error) {
      log('seguranca', 'Falha ao validar acesso HTTP.', error);
      res.status(503).json({ ok: false, motivo: 'Não foi possível validar o acesso agora.' });
    }
  };
}

const canReadSession = authorizeSession();
const canManageSession = authorizeSession({ manage: true });

app.get('/healthz', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true });
});

app.get('/status', (_req, res) => {
  res.json({ ok: true });
});

app.get('/sessao/:id/status', canReadSession, (req, res) => {
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

// Verificação SEM falso positivo: conexão aberta + usuário autenticado + leitura
// real dos grupos via protocolo (groupFetchAllParticipating).
app.get('/sessao/:id/verify', canReadSession, async (req, res) => {
  const sessao = sessoes.get(req.params.id);
  if (!sessao) {
    res.status(404).json({ conectado: false, motivo: 'Sessão não encontrada no bot.' });
    return;
  }
  try {
    const usuario = sessao.socket.user;
    const conectado = sessao.fase === 'vinculado' && Boolean(usuario && usuario.id);
    let totalChats = 0;
    if (conectado) {
      const grupos = await sessao.socket.groupFetchAllParticipating();
      totalChats = Object.keys(grupos || {}).length;
    }
    res.json({
      conectado: conectado && totalChats >= 0 && usuario != null,
      estado: conectado ? 'CONNECTED' : sessao.fase,
      telefone: sessao.telefone,
      totalChats,
    });
  } catch (erro) {
    res.json({ conectado: false, estado: 'INDISPONIVEL', telefone: sessao.telefone, totalChats: 0, motivo: String((erro && erro.message) || erro).slice(0, 200) });
  }
});

// Criação de grupo pela web. Com ?comunidade=<jid> tenta criar DENTRO da
// Comunidade; se a biblioteca não suportar sub-grupo, devolve orientação
// clara para criar no celular (Comunidade → Novo grupo) e sincronizar.
app.get('/sessao/:id/criar-grupo', canManageSession, async (req, res) => {
  const sessao = sessoes.get(req.params.id);
  const nome = String(req.query.nome || '').trim();
  const comunidade = String(req.query.comunidade || '').trim();
  if (!sessao || sessao.fase !== 'vinculado') {
    res.status(409).json({ ok: false, motivo: 'Número não está vinculado agora.' });
    return;
  }
  if (nome.length < 3 || nome.length > 80) {
    res.status(400).json({ ok: false, motivo: 'Nome do grupo deve ter entre 3 e 80 caracteres.' });
    return;
  }
  try {
    let grupo = null;
    if (comunidade) {
      // groupCreate(title, participants, parentNodeId?) — suporte a sub-grupo
      // de Comunidade varia por versão; detectamos pela assinatura.
      if (typeof sessao.socket.groupCreate === 'function' && sessao.socket.groupCreate.length >= 3) {
        grupo = await sessao.socket.groupCreate(nome, [], comunidade);
      } else {
        res.status(501).json({
          ok: false,
          motivo: 'Criar grupo dentro da Comunidade não é suportado nesta versão da biblioteca. Crie no celular (Comunidade → Novo grupo), depois use "Já criei — sincronizar agora" e selecione o grupo.',
        });
        return;
      }
    } else {
      grupo = await sessao.socket.groupCreate(nome, []);
    }
    if (!grupo || !grupo.id) {
      res.status(500).json({ ok: false, motivo: 'O WhatsApp não devolveu o identificador do grupo.' });
      return;
    }
    await supabase
      .from('bot_chats')
      .upsert(
        {
          sessao_id: sessao.id,
          chat_id: grupo.id,
          nome,
          tipo: 'grupo',
          comunidade_id: comunidade || null,
          comunidade_nome: comunidade ? 'Comunidade WhatsApp' : null,
          total_admins: 1,
          total_participantes: 1,
          visto_em: agoraIso(),
        },
        { onConflict: 'sessao_id,chat_id' },
      );
    log('grupo', `Grupo "${nome}" criado por ${sessao.telefone} (${grupo.id})${comunidade ? ` na comunidade ${comunidade}` : ''}`);
    res.json({ ok: true, chat_id: grupo.id, nome });
  } catch (erro) {
    res.status(500).json({ ok: false, motivo: String((erro && erro.message) || erro).slice(0, 200) });
  }
});

// Força a sincronização de chats da sessão.
app.get('/sessao/:id/sincronizar', canManageSession, async (req, res) => {
  const sessao = sessoes.get(req.params.id);
  if (!sessao || sessao.fase !== 'vinculado') {
    res.status(409).json({ ok: false, motivo: 'Número não está vinculado agora.' });
    return;
  }
  await sincronizarChats(sessao);
  res.json({ ok: true });
});

// Compatibilidade (era do whatsapp-web.js): apenas sincroniza.
app.get('/sessao/:id/recuperar', canManageSession, async (req, res) => {
  const sessao = sessoes.get(req.params.id);
  if (!sessao || sessao.fase !== 'vinculado') {
    res.status(409).json({ ok: false, motivo: 'Número não está vinculado agora.' });
    return;
  }
  await sincronizarChats(sessao);
  res.json({ ok: true, clicado: 'n/a (Baileys)', sincronizou: true });
});

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

app.get('/qr/:id', canReadSession, async (req, res) => {
  const sessao = sessoes.get(req.params.id);
  if (!sessao || !sessao.qr) {
    res.status(404).type('text').send('QR indisponível');
    return;
  }
  try {
    const dataUrl = await QRCode.toDataURL(sessao.qr, { margin: 1, width: 320 });
    const base64 = dataUrl.split(',')[1];
    res.type('img/png');
    res.end(Buffer.from(base64, 'base64'));
  } catch (_erro) {
    res.status(500).type('text').send('falha ao gerar QR');
  }
});

app.get('/sessao/:id', canReadSession, (_req, res) => {
  res.type('text').send('Use o painel TCS para visualizar este QR Code com segurança.');
});

app.get('/', (_req, res) => {
  res.json({ service: 'TCS WhatsApp Bot', ok: true });
});

setInterval(() => {
  gerenciarSessoes().catch((erro) => log('sessoes', 'Erro no ciclo de sessões', erro));
}, POLL_MS);

setInterval(() => {
  processarFila().catch((erro) => log('fila', 'Erro no ciclo da fila', erro));
}, POLL_MS);

// Publica comunicados agendados vencidos mesmo sem ninguém com tela aberta.
setInterval(() => {
  supabase.rpc('portal_publish_due_comunicados')
    .then(({ data, error }) => {
      if (!error && typeof data === 'number' && data > 0) {
        log('agenda', `${data} comunicado(s) agendado(s) publicado(s) agora`);
      }
    })
    .catch(() => null);
}, 30_000);

setInterval(() => {
  for (const sessao of sessoes.values()) {
    if (sessao.fase === 'vinculado') {
      sincronizarChats(sessao).catch(() => null);
    }
  }
}, CHAT_SYNC_MS);

setInterval(() => {
  reportarWorker('online').catch(() => null);
  for (const sessao of sessoes.values()) {
    reportarSessao(sessao).catch(() => null);
  }
}, HEARTBEAT_MS);

const server = app.listen(PORT, '0.0.0.0', () => {
  log('http', `Serviço do bot disponível na porta ${PORT} (números e QR por sessão)`);
  reportarWorker('online').catch(() => null);
});

let encerrando = false;
async function encerrar(signal) {
  if (encerrando) return;
  encerrando = true;
  log('shutdown', `${signal}: encerrando conexões com segurança`);
  server.close();
  await Promise.all([...sessoes.keys()].map((id) => pararSessao(id, { runtimeState: 'offline' })));
  await reportarWorker('stopping');
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));
