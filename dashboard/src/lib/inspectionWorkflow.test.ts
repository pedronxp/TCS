import { describe, expect, it } from 'vitest';
import { inspectionMediaLabel, nextInspectionMediaManifest, parseInspectionMediaStatus } from './inspectionWorkflow';

describe('inspection workflow', () => {
  it('never labels a protocol as full sync when expected photos are unknown or missing', () => {
    expect(inspectionMediaLabel(parseInspectionMediaStatus(null, 1))).toContain('quantidade esperada não informada');
    expect(inspectionMediaLabel(parseInspectionMediaStatus({ expected_count: 3, available_count: 1, pending_count: 2, revision: 10 }))).toBe('1 de 3 fotos disponíveis · 2 pendentes');
  });
  it('replacement resolves a pending asset without increasing the evidence count', () => {
    const old = { version: 1 as const, revision: 10, expected: 3, available: 2, items: [
      { id: 'a', position: 0, state: 'available' as const, storagePath: 'fotos:a' },
      { id: 'b', position: 1, state: 'pending' as const, storagePath: null },
      { id: 'c', position: 2, state: 'available' as const, storagePath: 'fotos:c' },
    ] };
    const next = nextInspectionMediaManifest('i', old, [], 'fotos:b-new', 'b');
    expect(next.expected).toBe(3); expect(next.available).toBe(3); expect(next.base_revision).toBe(10);
    expect(next.items[0].id).toBe('a'); expect(next.items[1].id).not.toBe('b');
    expect(() => nextInspectionMediaManifest('i', old, [], 'fotos:d')).toThrow('3');
  });
  it('removal is a newer generation and does not mutate the original snapshot', () => {
    const old = { version: 1 as const, revision: 12, expected: 1, available: 1, items: [{ id: 'a', position: 0, state: 'available' as const, storagePath: 'fotos:a' }] };
    const next = nextInspectionMediaManifest('i', old, [], null, 'a');
    expect(next.expected).toBe(0); expect(next.revision).toBeGreaterThan(12); expect(old.items).toHaveLength(1);
  });
});
