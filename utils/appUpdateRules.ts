export interface AppUpdateConfig {
  platform: string;
  enabled: boolean;
  mandatory: boolean;
  latestVersion: string;
  latestVersionCode: number;
  minRequiredVersionCode: number;
  apkUrl: string | null;
  message: string | null;
}

export interface InstalledAppVersion {
  version: string;
  versionCode: number;
}

export interface AppUpdateDecision {
  mustUpdate: boolean;
  hasUpdate: boolean;
  installed: InstalledAppVersion;
  config: AppUpdateConfig | null;
}

export function shouldForceUpdate(
  installedVersionCode: number,
  config: Pick<AppUpdateConfig, 'enabled' | 'mandatory' | 'minRequiredVersionCode' | 'apkUrl'> | null,
): boolean {
  if (!config?.enabled || !config.mandatory) return false;
  if (!config.apkUrl) return false;
  return installedVersionCode < Number(config.minRequiredVersionCode ?? 0);
}

export function hasAvailableUpdate(
  installedVersionCode: number,
  config: Pick<AppUpdateConfig, 'enabled' | 'latestVersionCode'> | null,
): boolean {
  if (!config?.enabled) return false;
  return installedVersionCode < Number(config.latestVersionCode ?? 0);
}
