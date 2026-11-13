jest.mock('../../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../utils/supabase';
import { loadOwnerExperience, saveOwnerExperience, canAccessPanelSection, canAccessPanelRoute } from '../OwnerExperienceService';

describe('owner experience', () => {
  beforeEach(() => jest.clearAllMocks());
  it('returns a confirmed missing preference for first use', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
    expect(await loadOwnerExperience('a', 'owner')).toEqual({ mode: null, source: 'server' });
  });
  it('does not turn a fetch error into first use and only reads this user cache', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'offline' } });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await expect(loadOwnerExperience('b', 'owner')).rejects.toThrow();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@owner_mobile_experience:b');
  });
  it('falls back to a validated cache when offline', async () => {
    (supabase.rpc as jest.Mock).mockRejectedValue(new Error('offline'));
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('operate');
    expect(await loadOwnerExperience('a', 'owner')).toEqual({ mode: 'operate', source: 'cache' });
  });
  it('never stores a choice the server rejected', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ error: { message: 'forbidden' } });
    await expect(saveOwnerExperience('a', 'owner', 'operate')).rejects.toThrow();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
  it('does not allow a customer to choose an owner mode', async () => {
    await expect(saveOwnerExperience('a', 'agent', 'operate')).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('authorizes owner navigation without granting it to other internal roles', () => {
    expect(canAccessPanelSection('owner', 'qe')).toBe(true);
    expect(canAccessPanelSection('owner', 'admin')).toBe(true);
    expect(canAccessPanelSection('support', 'qe')).toBe(false);
    expect(canAccessPanelSection('agent', 'internal')).toBe(false);
    expect(canAccessPanelSection('supervisor', 'qe')).toBe(true);
    expect(canAccessPanelSection('admin', 'master')).toBe(false);
  });
  it('allows entitled operational reports without opening the rest of administration', () => {
    expect(canAccessPanelRoute('agent', 'admin/relatorios', true)).toBe(true);
    expect(canAccessPanelRoute('supervisor', 'admin/relatorios', true)).toBe(true);
    expect(canAccessPanelRoute('agent', 'admin/relatorios', false)).toBe(false);
    expect(canAccessPanelRoute('agent', 'admin/usuarios', true)).toBe(false);
    expect(canAccessPanelRoute('support', 'admin/relatorios', true)).toBe(false);
    expect(canAccessPanelRoute('owner', 'admin/relatorios')).toBe(true);
  });
});
