/** Cookie (not localStorage) for the admin menu state, so the server renders
 * the menu already collapsed or open — no jump on page load. */
export const SIDEBAR_COOKIE = "mm-sidebar";

/** Browser only: remember the menu state for a year. */
export function saveSidebarCollapsed(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
}
