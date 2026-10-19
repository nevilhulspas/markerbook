// Canonical display locale, pinned so SSR and the browser always format
// dates and numbers identically (an unpinned toLocale* call follows the
// runtime's locale, which differs between the Node server and the browser
// and causes React hydration mismatches).
export const APP_LOCALE = 'en-GB'
