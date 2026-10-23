/** The endpoint the iPhone Shortcut posts a spoken/typed meal to. */
export const NUTRITION_LOG_PATH = '/api/nutrition/log'

/**
 * What a user pastes into the iPhone Shortcut: the log URL and the
 * Authorization header carrying their personal token. The header is the only
 * accepted form (a token in the URL would end up in logs).
 */
export function shortcutSetup(origin: string, token: string) {
  const headerValue = `Bearer ${token}`
  return {
    url: `${origin.replace(/\/+$/, '')}${NUTRITION_LOG_PATH}`,
    header: `Authorization: ${headerValue}`,
    headerValue,
  }
}
