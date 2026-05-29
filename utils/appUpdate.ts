import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { AppUpdateConfig, AppUpdateDecision, InstalledAppVersion } from './appUpdateRules';
import {
  hasAvailableUpdate,
  shouldForceUpdate,
} from './appUpdateRules';

export type { AppUpdateConfig, AppUpdateDecision, InstalledAppVersion } from './appUpdateRules';
export { hasAvailableUpdate, shouldForceUpdate } from './appUpdateRules';

const DEFAULT_ANDROID_VERSION_CODE = 0;

export function getInstalledAppVersion(): InstalledAppVersion {
  const expoConfig = Constants.expoConfig as any;
  const versionCode = Number(expoConfig?.android?.versionCode ?? DEFAULT_ANDROID_VERSION_CODE);
  return {
    version: String(expoConfig?.version ?? '0.0.0'),
    versionCode: Number.isFinite(versionCode) ? versionCode : DEFAULT_ANDROID_VERSION_CODE,
  };
}

function normalizeUpdateConfig(row: any): AppUpdateConfig | null {
  if (!row) return null;
  return {
    platform: String(row.platform || 'android'),
    enabled: Boolean(row.enabled),
    mandatory: Boolean(row.mandatory),
    latestVersion: String(row.latest_version || ''),
    latestVersionCode: Number(row.latest_version_code ?? 0),
    minRequiredVersionCode: Number(row.min_required_version_code ?? 0),
    apkUrl: row.apk_url ? String(row.apk_url) : null,
    message: row.message ? String(row.message) : null,
  };
}

export async function fetchAndroidUpdateConfig(): Promise<AppUpdateConfig | null> {
  const { data, error } = await supabase
    .from('app_update_config')
    .select('platform, enabled, mandatory, latest_version, latest_version_code, min_required_version_code, apk_url, message')
    .eq('platform', 'android')
    .eq('enabled', true)
    .maybeSingle();

  if (error) throw error;
  return normalizeUpdateConfig(data);
}

export async function checkAndroidAppUpdate(): Promise<AppUpdateDecision> {
  const installed = getInstalledAppVersion();
  const config = await fetchAndroidUpdateConfig();
  return {
    installed,
    config,
    mustUpdate: shouldForceUpdate(installed.versionCode, config),
    hasUpdate: hasAvailableUpdate(installed.versionCode, config),
  };
}
