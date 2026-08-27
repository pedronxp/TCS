'use strict';

function classifyDisconnect({ code, loggedOutCode, attempt, maxAttempts }) {
  if (code === loggedOutCode) {
    return {
      state: 'awaiting_qr',
      databaseStatus: 'aguardando_qr',
      clearCredentials: true,
      retry: false,
      delayMs: null,
    };
  }

  if (attempt >= maxAttempts) {
    return {
      state: 'offline',
      databaseStatus: 'desconectado',
      clearCredentials: false,
      retry: false,
      delayMs: null,
    };
  }

  return {
    state: 'reconnecting',
    databaseStatus: null,
    clearCredentials: false,
    retry: true,
    delayMs: 3_000 * (attempt + 1),
  };
}

function removeCurrentSession(sessions, id, expectedSession) {
  if (sessions.get(id) !== expectedSession) return false;
  sessions.delete(id);
  return true;
}

function canPersistSessionCredentials(sessions, id, expectedSession) {
  return sessions.get(id) === expectedSession && !expectedSession.encerramentoSolicitado;
}

function describeDisconnect({ code, error }) {
  const message = String(error?.message || error || '').toUpperCase();
  if (message.includes('ECONNREFUSED')) {
    return `Conexão com o WhatsApp recusada pelo provedor de rede (código ${code ?? 'indisponível'}).`;
  }
  if (message.includes('ETIMEDOUT') || message.includes('TIMEOUT') || code === 408) {
    return `Tempo esgotado ao conectar com o WhatsApp (código ${code ?? 'indisponível'}).`;
  }
  if (message.includes('WEBSOCKET')) {
    return `Canal seguro com o WhatsApp foi interrompido (código ${code ?? 'indisponível'}).`;
  }
  return `Conexão com o WhatsApp interrompida (código ${code ?? 'indisponível'}).`;
}

function resolveConnectTimeoutMs(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 30_000) return 60_000;
  return Math.min(parsed, 120_000);
}

function pairingPreparationChanged(currentValue, incomingValue) {
  return Boolean(incomingValue && currentValue !== incomingValue);
}

function normalizePairingPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return null;
}

function pairingPhoneMatches(expected, connected) {
  const expectedPhone = normalizePairingPhone(expected);
  const connectedPhone = normalizePairingPhone(connected);
  if (!expectedPhone || !connectedPhone) return false;
  return expectedPhone === connectedPhone;
}

function formatPairingCode(value) {
  const normalized = String(value || '').replace(/-/g, '');
  return normalized.length === 8
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

function classifyDeliveryOutcome({ success, attemptedSends }) {
  if (success) return 'enviado';
  return attemptedSends > 0 ? 'falhou' : 'pendente';
}

function isBroadcastRoomJid(value) {
  return typeof value === 'string' && /^\d+@newsletter$/.test(value);
}

function isAllowedDashboardOrigin(origin, allowedOrigins) {
  if (!origin || !allowedOrigins) return false;
  if (allowedOrigins.has(origin)) return true;

  let requestedOrigin;
  try {
    requestedOrigin = new URL(origin);
  } catch (_error) {
    return false;
  }
  if (requestedOrigin.origin !== origin || requestedOrigin.protocol !== 'https:') return false;

  for (const configuredOrigin of allowedOrigins) {
    let productionOrigin;
    try {
      productionOrigin = new URL(configuredOrigin);
    } catch (_error) {
      continue;
    }
    if (productionOrigin.protocol !== requestedOrigin.protocol
      || productionOrigin.port !== requestedOrigin.port
      || !productionOrigin.hostname.endsWith('.pages.dev')) continue;

    const expectedSuffix = `.${productionOrigin.hostname}`;
    if (!requestedOrigin.hostname.endsWith(expectedSuffix)) continue;
    const previewLabel = requestedOrigin.hostname.slice(0, -expectedSuffix.length);
    if (/^[a-z0-9][a-z0-9-]*$/i.test(previewLabel)) return true;
  }
  return false;
}

module.exports = {
  classifyDisconnect,
  removeCurrentSession,
  canPersistSessionCredentials,
  describeDisconnect,
  resolveConnectTimeoutMs,
  pairingPreparationChanged,
  normalizePairingPhone,
  pairingPhoneMatches,
  formatPairingCode,
  classifyDeliveryOutcome,
  isBroadcastRoomJid,
  isAllowedDashboardOrigin,
};
