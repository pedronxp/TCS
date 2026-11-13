import { buildOwnerConsoleUrl, classifyOwnerConsoleNavigation, OWNER_CONSOLE_SECTIONS } from '../OwnerConsoleService';

describe('embedded owner console boundary', () => {
  const origin = 'https://tcsvistoria.pages.dev';
  it('only builds known console destinations and never transports credentials in a URL', () => {
    expect(buildOwnerConsoleUrl('plans', origin)).toBe(`${origin}/app/planos`);
    expect(buildOwnerConsoleUrl('//evil.test', origin)).toBe(`${origin}/app`);
    expect(() => buildOwnerConsoleUrl('home', 'http://evil.test')).toThrow();
    expect(() => buildOwnerConsoleUrl('home', 'https://user:secret@tcsvistoria.pages.dev')).toThrow();
    expect(() => buildOwnerConsoleUrl('home', 'https://tcsvistoria.pages.dev/?access_token=secret')).toThrow();
  });
  it('keeps login and console pages within the trusted HTTPS origin', () => {
    expect(classifyOwnerConsoleNavigation(`${origin}/login`, origin)).toBe('internal');
    expect(classifyOwnerConsoleNavigation(`${origin}/app/staff`, origin)).toBe('internal');
    expect(classifyOwnerConsoleNavigation('https://tcsvistoria.pages.dev.evil.test/login', origin)).toBe('external');
    expect(classifyOwnerConsoleNavigation('javascript:alert(1)', origin)).toBe('blocked');
    expect(classifyOwnerConsoleNavigation('file:///secret', origin)).toBe('blocked');
    expect(classifyOwnerConsoleNavigation(`blob:${origin}/pdf`, origin)).toBe('internal');
    expect(classifyOwnerConsoleNavigation('blob:https://evil.test/pdf', origin)).toBe('blocked');
  });
  it('covers advanced areas of the existing console with fixed routes', () => {
    for (const key of ['customers', 'plans', 'subscriptions', 'billing', 'forms', 'risk', 'sessions', 'devices', 'communications', 'campaigns', 'builds', 'sync', 'storage', 'support']) {
      expect(OWNER_CONSOLE_SECTIONS.some(section => section.key === key)).toBe(true);
    }
  });
  it.each(['ai', 'whatsapp', 'tokens', 'staff'])('omits the disabled %s shortcut', section => {
    expect(buildOwnerConsoleUrl(section, origin)).toBe(`${origin}/app`);
  });
});
