import { describe, expect, it } from 'vitest';
import { safeConsoleDestination } from './routes';

describe('fronteira de rotas do console', () => {
  it('aceita somente destinos internos protegidos após login', () => {
    expect(safeConsoleDestination('/app/clientes?novo=1')).toBe('/app/clientes?novo=1');
    expect(safeConsoleDestination('https://example.com')).toBe('/app');
    expect(safeConsoleDestination('/login')).toBe('/app');
  });
});
