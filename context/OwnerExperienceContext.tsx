import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { loadOwnerExperience, saveOwnerExperience, type OwnerExperienceMode } from '../services/OwnerExperienceService';

interface OwnerExperienceValue {
  mode: OwnerExperienceMode | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => Promise<void>;
  choose: (mode: OwnerExperienceMode) => Promise<void>;
}
const OwnerExperienceContext = createContext<OwnerExperienceValue>({ mode: null, loading: true, saving: false, error: null, reload: async () => {}, choose: async () => {} });

export function OwnerExperienceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const role = profile?.role;
  const identity = `${uid}:${role}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [state, setState] = useState<{ identity: string; mode: OwnerExperienceMode | null; loading: boolean; error: string | null }>({ identity, mode: null, loading: true, error: null });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const reload = useCallback(async () => {
    if (!uid || role !== 'owner') {
      setState({ identity, mode: null, loading: false, error: null });
      return;
    }
    setState(previous => ({ identity, mode: previous.identity === identity ? previous.mode : null, loading: true, error: null }));
    try {
      const result = await loadOwnerExperience(uid, role);
      if (identityRef.current === identity) setState({ identity, mode: result.mode, loading: false, error: null });
    } catch {
      if (identityRef.current === identity) setState(previous => ({ ...previous, loading: false, error: 'Não foi possível carregar seu modo de uso. Confira a conexão e tente novamente.' }));
    }
  }, [identity, role, uid]);
  useEffect(() => { void reload(); }, [reload]);
  const choose = useCallback(async (mode: OwnerExperienceMode) => {
    if (!uid || role !== 'owner' || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveOwnerExperience(uid, role, mode);
      if (identityRef.current === identity) setState({ identity, mode, loading: false, error: null });
    } finally { savingRef.current = false; setSaving(false); }
  }, [identity, role, uid]);
  const current = state.identity === identity ? state : { mode: null, loading: role === 'owner', error: null };
  return <OwnerExperienceContext.Provider value={{ ...current, saving, reload, choose }}>{children}</OwnerExperienceContext.Provider>;
}
export const useOwnerExperience = () => useContext(OwnerExperienceContext);
