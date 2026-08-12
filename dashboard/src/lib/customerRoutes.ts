export type CustomerRouteKind = 'organization' | 'user';

function splitCustomerId(customerId: string): { kind: CustomerRouteKind; id: string } | null {
  const separator = customerId.indexOf(':');
  if (separator <= 0 || separator === customerId.length - 1) return null;
  const kind = customerId.slice(0, separator);
  const id = customerId.slice(separator + 1);
  return kind === 'organization' || kind === 'user' ? { kind, id } : null;
}

export function customerDetailPath(customerId: string, section?: string) {
  const parsed = splitCustomerId(customerId);
  if (!parsed) return '/app/clientes';
  const segment = parsed.kind === 'organization' ? 'organizacoes' : 'contas';
  const suffix = section && section !== 'resumo' ? `/${encodeURIComponent(section)}` : '';
  return `/app/clientes/${segment}/${encodeURIComponent(parsed.id)}${suffix}`;
}

export function customerIdFromRoute(kind: CustomerRouteKind, rawId: string) {
  try {
    const id = decodeURIComponent(rawId).trim();
    return id ? `${kind}:${id}` : null;
  } catch {
    return null;
  }
}

export function legacyCustomerDetailPath(rawCustomerId: string, section?: string) {
  try {
    return customerDetailPath(decodeURIComponent(rawCustomerId), section);
  } catch {
    return '/app/clientes';
  }
}

export function legacyCustomerMemberPath(rawCustomerId: string, rawMemberId: string) {
  const base = legacyCustomerDetailPath(rawCustomerId, 'equipe');
  if (base === '/app/clientes') return base;
  try {
    const memberId = decodeURIComponent(rawMemberId).trim();
    return memberId ? `${base}?membro=${encodeURIComponent(memberId)}` : base;
  } catch {
    return base;
  }
}
