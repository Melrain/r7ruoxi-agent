/** Cross-tree refresh hook used after canvas analyze (desktop has no Grok usage chip yet). */
export const GROK_USAGE_REFRESH_EVENT = "r7:grok-usage-refresh"

export function requestGrokUsageRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(GROK_USAGE_REFRESH_EVENT))
}
