'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let lifecycle = {};
try {
  lifecycle = require('./session-lifecycle');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

test('sessão encerrada pelo WhatsApp exige novo pareamento sem falso banimento', () => {
  const outcome = lifecycle.classifyDisconnect?.({
    code: 401,
    loggedOutCode: 401,
    attempt: 0,
    maxAttempts: 5,
  });

  assert.equal(outcome?.state, 'awaiting_qr');
  assert.equal(outcome?.databaseStatus, 'aguardando_qr');
  assert.equal(outcome?.clearCredentials, true);
  assert.equal(outcome?.retry, false);
});

test('queda temporária mantém reconexão automática enquanto houver tentativas', () => {
  const outcome = lifecycle.classifyDisconnect?.({
    code: 408,
    loggedOutCode: 401,
    attempt: 2,
    maxAttempts: 5,
  });

  assert.equal(outcome?.state, 'reconnecting');
  assert.equal(outcome?.databaseStatus, null);
  assert.equal(outcome?.retry, true);
  assert.equal(outcome?.delayMs, 9000);
});

test('última tentativa encerrada marca a sessão como desconectada', () => {
  const outcome = lifecycle.classifyDisconnect?.({
    code: 408,
    loggedOutCode: 401,
    attempt: 5,
    maxAttempts: 5,
  });

  assert.equal(outcome?.state, 'offline');
  assert.equal(outcome?.databaseStatus, 'desconectado');
  assert.equal(outcome?.retry, false);
});

test('normaliza telefone brasileiro para o pareamento por código', () => {
  assert.equal(lifecycle.normalizePairingPhone?.('+55 (32) 98479-2322'), '5532984792322');
  assert.equal(lifecycle.normalizePairingPhone?.('32 98479-2322'), '5532984792322');
  assert.equal(lifecycle.normalizePairingPhone?.('123'), null);
});

test('confirma somente a conta realmente esperada no pareamento', () => {
  assert.equal(lifecycle.pairingPhoneMatches?.('32 98479-2322', '5532984792322'), true);
  assert.equal(lifecycle.pairingPhoneMatches?.('32 98479-2322', '5532999999999'), false);
  assert.equal(lifecycle.pairingPhoneMatches?.('', '5532984792322'), false);
});

test('formata o código de vinculação sem alterar seus caracteres', () => {
  assert.equal(lifecycle.formatPairingCode?.('ABCD1234'), 'ABCD-1234');
});

test('mantém o comunicado pendente quando não existe sessão realmente conectada', () => {
  assert.equal(lifecycle.classifyDeliveryOutcome?.({ success: false, attemptedSends: 0 }), 'pendente');
  assert.equal(lifecycle.classifyDeliveryOutcome?.({ success: false, attemptedSends: 1 }), 'falhou');
  assert.equal(lifecycle.classifyDeliveryOutcome?.({ success: true, attemptedSends: 1 }), 'enviado');
});

test('identifica somente canais oficiais do WhatsApp como salas de transmissão privadas', () => {
  assert.equal(lifecycle.isBroadcastRoomJid?.('120363000000000001@newsletter'), true);
  assert.equal(lifecycle.isBroadcastRoomJid?.('120363000000000001@g.us'), false);
  assert.equal(lifecycle.isBroadcastRoomJid?.('status@broadcast'), false);
  assert.equal(lifecycle.isBroadcastRoomJid?.(null), false);
});

test('autoriza previews do Cloudflare pertencentes ao domínio de produção configurado', () => {
  const allowedOrigins = new Set(['https://tcsvistoria.pages.dev']);

  assert.equal(lifecycle.isAllowedDashboardOrigin?.('https://tcsvistoria.pages.dev', allowedOrigins), true);
  assert.equal(lifecycle.isAllowedDashboardOrigin?.('https://707af5f2.tcsvistoria.pages.dev', allowedOrigins), true);
  assert.equal(lifecycle.isAllowedDashboardOrigin?.('https://codex-whatsapp.tcsvistoria.pages.dev', allowedOrigins), true);
});

test('rejeita origens externas que tentam imitar um preview autorizado', () => {
  const allowedOrigins = new Set(['https://tcsvistoria.pages.dev']);

  assert.equal(lifecycle.isAllowedDashboardOrigin?.('https://outro.pages.dev', allowedOrigins), false);
  assert.equal(lifecycle.isAllowedDashboardOrigin?.('https://tcsvistoria.pages.dev.exemplo.com', allowedOrigins), false);
  assert.equal(lifecycle.isAllowedDashboardOrigin?.('http://707af5f2.tcsvistoria.pages.dev', allowedOrigins), false);
  assert.equal(lifecycle.isAllowedDashboardOrigin?.('https://nested.preview.tcsvistoria.pages.dev', allowedOrigins), false);
});

test('exige autorização da organização e canal oficial para criar uma sala de transmissão', () => {
  const server = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  assert.match(server, /app\.post\('\/sessao\/:id\/transmissao', canManageSession/);
  assert.match(server, /sessao\.socket\.newsletterCreate\(nome, descricao \|\| undefined\)/);
  assert.match(server, /isBroadcastRoomJid\(canal\?\.id\)/);
  assert.match(server, /tipo:\s*'transmissao'/);
});

test('inclui o ciclo de vida das sessões na imagem publicada no Render', () => {
  const dockerfile = fs.readFileSync(path.join(__dirname, 'Dockerfile'), 'utf8');
  assert.match(dockerfile, /^COPY\s+.*session-lifecycle\.js.*\s+\.\/$/m);
});
