// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BotServiceStatus } from './BotServiceStatus';
import { resolveNavigation } from '@/config/navigation';

const mocks = vi.hoisted(() => ({ online: vi.fn(), organizations: vi.fn(), runtime: vi.fn() }));
vi.mock('@/lib/comunicados', () => ({
  fetchBotOnline: mocks.online,
  fetchOrgsComunicadosConsole: mocks.organizations,
  fetchPortalBotRuntimeStatus: mocks.runtime,
}));
afterEach(cleanup);

it.each(['internal', 'organization'] as const)('keeps disabled WhatsApp hidden without polling in %s', workspace => {
  const { container } = render(<BotServiceStatus workspace={workspace} />);
  expect(container.textContent).toBe('');
  expect(mocks.online).not.toHaveBeenCalled();
  expect(mocks.organizations).not.toHaveBeenCalled();
  expect(mocks.runtime).not.toHaveBeenCalled();
});

it.each(['owner', 'developer'] as const)('omits WhatsApp even with permission for %s', role => {
  const links = resolveNavigation(role, ['console.read', 'whatsapp.read']).flatMap(group => group.items);
  expect(links.some(link => link.to.startsWith('/app/whatsapp'))).toBe(false);
});
