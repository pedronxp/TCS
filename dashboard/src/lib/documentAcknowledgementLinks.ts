export type AcknowledgementLinkResult = {
  token: string;
  expiresAt: string;
};

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function parseAcknowledgementLinkResult(value: unknown): AcknowledgementLinkResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  const token = typeof result.token === 'string' ? result.token.toLowerCase() : '';
  const expiresAt = typeof result.expires_at === 'string' ? result.expires_at : '';
  if (result.ok !== true || !TOKEN_PATTERN.test(token) || !expiresAt || Number.isNaN(Date.parse(expiresAt))) return null;
  return { token, expiresAt };
}

export function buildAcknowledgementUrl(tokenValue: string, origin: string): string {
  const token = tokenValue.toLowerCase();
  if (!TOKEN_PATTERN.test(token)) throw new Error('invalid_acknowledgement_token');
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('invalid_acknowledgement_origin');
  }
  url.pathname = `/ciencia/${encodeURIComponent(token)}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
