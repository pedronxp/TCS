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

function normalizePairingPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return null;
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

module.exports = {
  classifyDisconnect,
  normalizePairingPhone,
  formatPairingCode,
  classifyDeliveryOutcome,
  isBroadcastRoomJid,
};
