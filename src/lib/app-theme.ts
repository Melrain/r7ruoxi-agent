/** Shell chrome theme — driven by workspace (film → dark; else light). */

export type AppTheme = "light" | "dark"

/** Absolute mapping: film is dark; every other workspace is light. */
export function themeForWorkspace(workspace: string): AppTheme {
  return workspace === "film" ? "dark" : "light"
}

/** Monotonic epoch so async/stale applies are ignored. */
let applyEpoch = 0

export function bumpThemeApplyEpoch(): number {
  applyEpoch += 1
  return applyEpoch
}

export function currentThemeApplyEpoch(): number {
  return applyEpoch
}

/**
 * Apply shell theme on `document.documentElement` and `.app-shell`.
 * If `epoch` is provided and no longer current, the call is a no-op (stale).
 */
export function applyAppTheme(theme: AppTheme, epoch?: number): void {
  if (epoch !== undefined && epoch !== applyEpoch) return

  const root = document.documentElement
  root.setAttribute("data-theme", theme)

  const shell = document.querySelector(".app-shell")
  if (shell instanceof HTMLElement) {
    shell.setAttribute("data-theme", theme)
  }
}

/** Force light chrome (unmount / leave app shell). */
export function restoreLightAppTheme(): void {
  bumpThemeApplyEpoch()
  applyAppTheme("light")
}
