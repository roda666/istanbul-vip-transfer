/**
 * Google returns machine-oriented error query values to OAuth callbacks.
 * Keep those values out of the settings URL and UI except for the one
 * user-actionable cancellation state.
 */
export function classifyGoogleOAuthProviderError(error: string): 'user_cancelled' | 'server_error' {
  return error === 'access_denied' ? 'user_cancelled' : 'server_error';
}