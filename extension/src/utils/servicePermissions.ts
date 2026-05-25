import { browser } from 'wxt/browser';
import type { Settings } from '../types';
import type { EnrichmentMode } from './enrichmentMode';

export function getServicePermissionOrigins(settings: Settings, mode: EnrichmentMode): string[] {
  const origins = compactOrigins([getOriginPattern(settings.aiApiUrl)]);
  if (mode === 'smartEnrichment') origins.push('https://r.jina.ai/*');
  return Array.from(new Set(origins));
}

export async function ensureServicePermissionsDuringUserGesture(settings: Settings, mode: EnrichmentMode): Promise<void> {
  const origins = getServicePermissionOrigins(settings, mode);
  if (origins.length === 0) throw new Error('Invalid service URL');

  const hasPermission = await browser.permissions.contains({ origins });
  if (hasPermission) return;

  const granted = await browser.permissions.request({ origins });
  if (!granted) throw new Error('Permission denied for the configured service URL');
}

export async function hasServicePermissions(settings: Settings, mode: EnrichmentMode): Promise<boolean> {
  const origins = getServicePermissionOrigins(settings, mode);
  if (origins.length === 0) return false;
  return browser.permissions.contains({ origins });
}

function getOriginPattern(serviceUrl: string): string {
  try {
    const url = new URL(serviceUrl);
    return `${url.origin}/*`;
  } catch {
    return '';
  }
}

function compactOrigins(origins: string[]): string[] {
  return origins.filter(origin => origin.trim());
}
