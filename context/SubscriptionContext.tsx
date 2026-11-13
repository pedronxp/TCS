import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import { featureIsAvailable } from '../utils/subscription';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'past_due' | 'suspended' | 'canceled' | 'expired';

export interface UsageItem {
  resource: 'users' | 'inspections' | 'invitations' | 'storage_bytes' | 'sessions';
  consumed: number;
  limit: number | null;
  warning_percent: number;
}

export interface SubscriptionContextValue {
  enforced: boolean;
  organization: { id: string; display_name: string; status: string } | null;
  membership: { role: 'master' | 'admin' | 'supervisor' | 'agent'; status: 'invited' | 'active' | 'suspended' | 'removed' } | null;
  subscription: { id: string; status: SubscriptionStatus; period_start: string; period_end: string | null; grace_ends_at: string | null; renewal_required?: boolean; billing_cycle?: string } | null;
  plan: {
    id: string;
    code: string;
    name: string;
    audience: string;
    version: number;
    commercial?: {
      monthly_price_cents?: number | null;
      annual_price_cents?: number | null;
      currency?: 'BRL';
      trial_days?: number;
      grace_days?: number;
      overage_policy?: 'block' | 'manual_review' | 'allow_and_bill' | 'custom';
      support_tier?: 'standard' | 'priority' | 'specialized';
      support_channels?: string[];
      support_hours?: string;
    };
  } | null;
  features: Record<string, boolean>;
  usage: UsageItem[];
}

interface Value {
  context: SubscriptionContextValue | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasFeature: (code: string) => boolean;
}

const SubscriptionContext = createContext<Value>({
  context: null,
  loading: false,
  error: null,
  refresh: async () => {},
  hasFeature: () => false,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const actorId = session?.user.id;
  const [snapshot, setSnapshot] = useState<{ actorId: string; context: SubscriptionContextValue | null } | null>(null);
  const context = snapshot && snapshot.actorId === actorId ? snapshot.context : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestVersion.current;
    if (!actorId) {
      setSnapshot(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_subscription_context');
      if (currentRequest !== requestVersion.current) return;
      if (rpcError || !data || !Array.isArray(data.usage)) throw new Error('invalid_subscription_context');
      setSnapshot({ actorId, context: data as SubscriptionContextValue });
      setError(null);
      // A storage failure must not discard a successful server response.
      try { await AsyncStorage.setItem(`@subscription_context:${actorId}`, JSON.stringify(data)); } catch {}
    } catch {
      if (currentRequest === requestVersion.current) {
        setError('Não foi possível atualizar a assinatura. Confira a conexão e tente novamente.');
        try {
          const stored = await AsyncStorage.getItem(`@subscription_context:${actorId}`);
          const cached = stored ? JSON.parse(stored) : null;
          if (currentRequest === requestVersion.current && cached && typeof cached.enforced === 'boolean'
            && Array.isArray(cached.usage) && cached.features && typeof cached.features === 'object') {
            // Date-aware entitlement checks still reject elapsed cached cycles.
            setSnapshot(previous => previous?.actorId === actorId ? previous : { actorId, context: cached });
          }
        } catch {}
      }
    } finally {
      if (currentRequest === requestVersion.current) setLoading(false);
    }
  }, [actorId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestVersion.current += 1;
    };
  }, [refresh]);

  const value = useMemo<Value>(() => ({
    context,
    loading,
    error,
    refresh,
    hasFeature: (code) => featureIsAvailable(context, code),
  }), [context, loading, error, refresh]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
