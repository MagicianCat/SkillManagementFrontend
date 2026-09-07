const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!configuredApiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is required')
}

/**
 * Development requests stay same-origin and are forwarded by Vite. Production
 * builds use the configured absolute URL directly.
 */
export const apiBaseUrl = import.meta.env.DEV
  ? new URL(configuredApiBaseUrl, window.location.origin).pathname.replace(/\/$/, '')
  : configuredApiBaseUrl.replace(/\/$/, '')

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
