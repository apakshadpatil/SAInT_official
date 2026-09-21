/**
 * URL validation utilities for external registration links.
 * Allows valid https: and http: URLs.
 * Strictly forbids unsafe protocols such as javascript:, data:, vbscript:, and file:.
 */

const FORBIDDEN_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

/**
 * Checks if a given registration URL is valid and safe.
 * Since the field is optional, empty, null, or undefined values return true.
 */
export function isValidRegistrationUrl(url?: string | null): boolean {
  if (!url || !url.trim()) {
    return true; // Optional field
  }

  const trimmed = url.trim().toLowerCase();

  for (const scheme of FORBIDDEN_SCHEMES) {
    if (trimmed.startsWith(scheme)) {
      return false;
    }
  }

  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes and returns a safe registration URL or undefined if empty/invalid.
 */
export function sanitizeRegistrationUrl(url?: string | null): string | undefined {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();
  return isValidRegistrationUrl(trimmed) ? trimmed : undefined;
}
