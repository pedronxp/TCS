import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { generateUUID } from './uuid';

export type ClientTechnicalCategory = 'sync' | 'storage' | 'runtime' | 'version';
export type ClientTechnicalSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ClientTechnicalEvent {
  category: ClientTechnicalCategory;
  severity: ClientTechnicalSeverity;
  summary: string;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

const ALLOWED_METADATA_KEYS = new Set([
  'operation', 'attempt', 'failed_count', 'success_count', 'pending_count',
  'retry_exhausted', 'bucket', 'background', 'subscription_limited',
]);

export function sanitizeClientTechnicalMetadata(
  metadata: ClientTechnicalEvent['metadata'] = {},
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      ALLOWED_METADATA_KEYS.has(key)
      && (value == null || ['string', 'number', 'boolean'].includes(typeof value)),
    ),
  );
}

/** Best-effort telemetry: it must never block the user workflow or contain raw errors/PII. */
export async function reportClientTechnicalEvent(event: ClientTechnicalEvent): Promise<void> {
  const summary = event.summary.trim().slice(0, 500);
  if (!summary) return;

  const { error } = await supabase.rpc('ingest_client_technical_event', {
    p_event_key: generateUUID(),
    p_app_version: Constants.expoConfig?.version ?? null,
    p_platform: Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown',
    p_category: event.category,
    p_severity: event.severity,
    p_correlation_id: event.correlationId?.slice(0, 120) ?? null,
    p_summary: summary,
    p_metadata: sanitizeClientTechnicalMetadata(event.metadata),
  });

  if (error) throw error;
}

export function reportClientTechnicalEventSafely(event: ClientTechnicalEvent): void {
  void reportClientTechnicalEvent(event).catch(() => undefined);
}
