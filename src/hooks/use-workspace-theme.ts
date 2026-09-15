import { useLayoutEffect, useRef } from "react"
import {
  applyAppTheme,
  bumpThemeApplyEpoch,
  restoreLightAppTheme,
  themeForWorkspace,
} from "@/lib/app-theme"
import type { WorkspaceId } from "@/shell/types"

/**
 * Derive shell theme absolutely from `workspace` each layout pass.
 * Does not undo via effect cleanup on workspace change (avoids film→light
 * then film→dark flicker on rapid toggles). Unmount restores light.
 */
export function useWorkspaceTheme(workspace: WorkspaceId): void {
  const epochRef = useRef(0)

  useLayoutEffect(() => {
    const epoch = bumpThemeApplyEpoch()
    epochRef.current = epoch
    applyAppTheme(themeForWorkspace(workspace), epoch)
    // Intentionally no theme-undo cleanup here — next run sets the final theme.
  }, [workspace])

  useLayoutEffect(() => {
    return () => {
      restoreLightAppTheme()
    }
  }, [])
}
