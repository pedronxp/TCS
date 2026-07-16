jest.mock('expo-constants', () => ({ expoConfig: { version: '1.3.16' } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { supabase } from './supabase';
import { reportClientTechnicalEvent, sanitizeClientTechnicalMetadata } from './technicalEvents';

describe('technicalEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps only the non-sensitive telemetry allowlist', () => {
    expect(sanitizeClientTechnicalMetadata({ operation: 'upload', failed_count: 2, bucket: 'fotos', token: 'nope', email: 'nope' } as any))
      .toEqual({ operation: 'upload', failed_count: 2, bucket: 'fotos' });
  });

  it('sends a sanitized, bounded event envelope', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: 7, error: null });
    await reportClientTechnicalEvent({ category: 'sync', severity: 'error', summary: ' falha ', metadata: { failed_count: 1 } });
    expect(supabase.rpc).toHaveBeenCalledWith('ingest_client_technical_event', expect.objectContaining({
      p_app_version: '1.3.16', p_platform: 'android', p_category: 'sync', p_summary: 'falha', p_metadata: { failed_count: 1 },
    }));
  });
});
