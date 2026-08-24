// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { buildAuthCallbackUrl, resolveAccountEntry } from './account-entry';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    },
  },
}));

describe('entrada unificada por perfil e vínculo', () => {
  it('identifica o retorno Google na tela intermediária e preserva destinos internos', () => {
    const url = new URL(buildAuthCallbackUrl('portal', '/portal/municipal/vistorias'));

    expect(url.pathname).toBe('/auth/callback');
    expect(url.searchParams.get('source')).toBe('portal');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('returnTo')).toBe('/portal/municipal/vistorias');
  });

  it('não permite redirecionamentos externos durante a autorização Google', () => {
    const url = new URL(buildAuthCallbackUrl('console', '//outro-site.example'));

    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.has('returnTo')).toBe(false);
  });

  it('encaminha equipe interna ativa e autorizada para o Console', () => {
    expect(resolveAccountEntry({
      userId: 'staff-1',
      internalProfile: {
        user_id: 'staff-1',
        role: 'owner',
        status: 'active',
        permissions: ['console.read'],
      },
      accountKind: 'organization',
      returnTo: '/app/clientes',
    })).toMatchObject({ kind: 'internal', destination: '/app/clientes' });
  });

  it('não concede Console para staff suspenso ou sem permissão', () => {
    for (const staff of [
      { user_id: 'staff-1', role: 'support', status: 'suspended', permissions: ['console.read'] },
      { user_id: 'staff-1', role: 'support', status: 'active', permissions: [] },
    ]) {
      expect(resolveAccountEntry({ userId: 'staff-1', internalProfile: staff }))
        .toMatchObject({ kind: 'restricted', destination: '/login?status=acesso-restrito' });
    }
  });

  it('exige que o perfil interno pertença à sessão autenticada', () => {
    expect(resolveAccountEntry({
      userId: 'customer-1',
      internalProfile: {
        user_id: 'other-user',
        role: 'owner',
        status: 'active',
        permissions: ['console.read'],
      },
      accountKind: 'individual',
    })).toMatchObject({ kind: 'individual', destination: '/portal/individual' });
  });

  it('libera o portal municipal apenas com vínculo ativo', () => {
    expect(resolveAccountEntry({
      userId: 'agent-1',
      internalProfile: null,
      accountKind: 'organization',
      membershipStatus: 'active',
      returnTo: '/portal/municipal/vistorias',
    })).toMatchObject({ kind: 'organization', destination: '/portal/municipal/vistorias' });

    expect(resolveAccountEntry({
      userId: 'agent-1',
      internalProfile: null,
      accountKind: 'organization',
      membershipStatus: 'suspended',
    })).toMatchObject({ kind: 'restricted', destination: '/entrar?status=vinculo-inativo' });
  });

  it('mantém os destinos de conta individual isolados do Console e da organização', () => {
    expect(resolveAccountEntry({
      userId: 'customer-1',
      internalProfile: null,
      accountKind: 'individual',
      returnTo: '/app/clientes',
    })).toMatchObject({ kind: 'individual', destination: '/portal/individual' });
  });

  it('direciona contas sem vínculo para a escolha individual ou municipal', () => {
    expect(resolveAccountEntry({ userId: 'new-user', internalProfile: null }))
      .toMatchObject({ kind: 'onboarding', destination: '/entrar' });
  });

  it('não abre portais quando a conta está bloqueada', () => {
    expect(resolveAccountEntry({
      userId: 'blocked-user',
      internalProfile: null,
      accountKind: 'individual',
      lifecycleState: 'blocked',
    })).toMatchObject({ kind: 'restricted', destination: '/entrar?status=sem-acesso' });
  });
});
