/** Web #14-era race guards: abort stillMine, cross-project callbacks. */

export type FilmRunToken = {
  runId: string
  projectId: string
  nodeId?: string
}

let seq = 0

export function createFilmRunToken(projectId: string, nodeId?: string): FilmRunToken {
  seq += 1
  const runId = `run_${seq}_${Date.now().toString(36)}`
  return {
    runId,
    projectId,
    ...(nodeId ? { nodeId } : {}),
  }
}

/** True iff this callback still belongs to the same in-flight run + project. */
export function stillMine(
  token: FilmRunToken,
  current: { projectId?: string | null; runId?: string | null; aborted?: boolean },
): boolean {
  if (current.aborted) return false
  if (!token.runId || current.runId !== token.runId) return false
  if (!token.projectId || current.projectId !== token.projectId) return false
  return true
}

export function bumpFilmRunEpoch(epoch: number) {
  return epoch + 1
}
