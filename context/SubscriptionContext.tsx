import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import { featureIsAvailable } from '../utils/subscription';

export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'past_due' | 'canceled' | 'expired';

export interface UsageItem {
  resource: 'users' | 'inspections' | 'invitations' | 'storage_bytes' | 'sessions';
  consumed: number;
  limit: number | null;
  warning_percent: number;
}

export interface SubscriptionContextValue {
  enforced: boolean;
  organization: { id: string; display_name: string; status: string } | null;
  membership: { role: 'owner' | 'coordinator' | 'supervisor' | 'agent'; status: string } | null;
  subscription: { id: string; status: SubscriptionStatus; period_start: string; period_end: string | null; grace_ends_at: string | null } | null;
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
  hasFeature: () => true,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { session, localTestMode } = useAuth();
  const [context, setContext] = useState<SubscriptionContextValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || localTestMode) {
      setContext(null);
      setError(null);
      return;
    }
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc('get_subscription_context');
    if (rpcError) {
      // Compatibilidade: deployments anteriores à migration continuam liberados.
      setContext(null);
      setError('O contexto comercial ainda não foi ativado neste ambiente.');
    } else {
      setContext(data as SubscriptionContextValue);
      setError(null);
    }
    setLoading(false);
  }, [session, localTestMode]);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
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
