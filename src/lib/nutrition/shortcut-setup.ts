/** The endpoint the iPhone Shortcut posts a spoken/typed meal to. */
export const NUTRITION_LOG_PATH = '/api/nutrition/log'

/**
 * What a user pastes into the iPhone Shortcut: the log URL and the
 * Authorization header carrying their personal token. The header form is the
 * recommended setup; `?token=` in the URL still works but ends up in logs.
 */
export function shortcutSetup(origin: string, token: string) {
  const headerValue = `Bearer ${token}`
  return {
    url: `${origin.replace(/\/+$/, '')}${NUTRITION_LOG_PATH}`,
    header: `Authorization: ${headerValue}`,
    headerValue,
  }
}
