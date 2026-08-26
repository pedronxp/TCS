import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAcknowledgementUrl,
  parseAcknowledgementLinkResult,
} from '../dashboard/src/lib/documentAcknowledgementLinks.ts';

const token = 'a'.repeat(64);

test('aceita somente uma resposta completa da criação do link', () => {
  assert.deepEqual(parseAcknowledgementLinkResult({
    ok: true,
    token,
    expires_at: '2026-08-29T12:00:00.000Z',
  }), {
    token,
    expiresAt: '2026-08-29T12:00:00.000Z',
  });
  assert.equal(parseAcknowledgementLinkResult({ ok: true, token: 'curto', expires_at: '2026-08-29T12:00:00.000Z' }), null);
  assert.equal(parseAcknowledgementLinkResult({ ok: true, token, expires_at: 'data-invalida' }), null);
});

test('monta a rota pública sem aceitar protocolo inseguro', () => {
  assert.equal(
    buildAcknowledgementUrl(token.toUpperCase(), 'https://portal.tcs.test/portal/municipal/ciencias?x=1'),
    `https://portal.tcs.test/ciencia/${token}`,
  );
  assert.throws(() => buildAcknowledgementUrl(token, 'javascript:alert(1)'), /invalid_acknowledgement_origin/);
  assert.throws(() => buildAcknowledgementUrl('token-invalido', 'https://portal.tcs.test'), /invalid_acknowledgement_token/);
});
