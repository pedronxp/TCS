import { describe, expect, it } from 'vitest';
import { resolveNavigation } from '@/config/navigation';

describe('resolveNavigation', () => {
  it('shows only permitted owner destinations', () => {
    const groups = resolveNavigation('owner', ['dashboard.executive.read', 'customer.read', 'commercial.read']);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain('Visão executiva');
    expect(labels).toContain('Planos');
    expect(labels).not.toContain('Equipe interna');
    expect(labels).not.toContain('Logs e erros');
  });

  it('resolves the developer navigation without leaking commercial screens', () => {
    const groups = resolveNavigation('developer', ['dashboard.technical.read', 'technical.read', 'build.request', 'audit.read']);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual(expect.arrayContaining(['Saúde técnica', 'Versões', 'Builds', 'Logs e erros', 'Auditoria']));
    expect(labels).not.toContain('Planos');
    expect(labels).not.toContain('Equipe interna');
  });
});
