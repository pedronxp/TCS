import type { Json } from '@/types/supabase';

export type JsonObject = { [key: string]: Json | undefined };

export function jsonObject(value: Json | null | undefined): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function jsonString(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

export function jsonNumber(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function jsonBoolean(value: Json | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function jsonArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}
