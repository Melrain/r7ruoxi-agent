import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { studioErrorMessage } from "@/lib/api/client"
import { filmGrokPreflightQueryKey } from "@/lib/api/film"
import {
  currentFilmUserId,
  useFilmCurrentProject,
  useFilmGrokPreflight,
} from "@/hooks/use-film-project"
import { useLiveEventsGate } from "@/lib/live-events-gate"
import {
  subscribeExecutorSourcePreference,
  writeExecutorSourcePreference,
} from "@/lib/executor-source"
import {
  canFilmAnalyze,
  filmAnalyzeGateReason,
  filmGrokAuthLabel,
  filmGrokCheckingLabel,
  mergeFilmGrokStatus,
  type FilmRunnerSource,
} from "@/lib/film-grok-preflight"
import { resolveFilmRunnerSource } from "@/lib/film/runner"
import {
  filmIsAnalyzing,
  filmNextActionMessage,
  isFilmProjectBusy,
} from "@/lib/film-package"
import { FilmFollowPage } from "./film-follow-page"
import { FilmGrokStatus } from "./film-grok-status"
import { FilmProjectSwitcher } from "./film-project-switcher"

const WorkspaceShell = lazy(async () => {
  const mod = await import("./canvas/WorkspaceShell")
  return { default: mod.WorkspaceShell }
})

/**
 * Desktop film main entry — isomorphic with web `/video`:
 * default = Melrain infinite canvas; classic StageRiver = secondary.
 */
export function FilmStudio() {
  const [view, setView] = useState<"canvas" | "classic">("canvas")
  const [sourceEpoch, setSourceEpoch] = useState(0)
  const queryClient = useQueryClient()

  useEffect(() => {
    return subscribeExecutorSourcePreference(() => {
      setSourceEpoch((value) => value + 1)
      void queryClient.invalidateQueries({ queryKey: filmGrokPreflightQueryKey() })
    })
  }, [queryClient])
  const current = useFilmCurrentProject(true)
  const project = current.data
  const preflight = useFilmGrokPreflight(true, project)
  const error = current.error ? studioErrorMessage(current.error) : ""
  const hint = project ? filmNextActionMessage(project) : ""
  const busy = isFilmProjectBusy(project)
  const grokStatus = mergeFilmGrokStatus(preflight.data, project?.grok)
  const runnerSource = useMemo(
    () => resolveFilmRunnerSource(project),
    // sourceEpoch：偏好写入后强制重读 localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, sourceEpoch],
  )
  const canAnalyze = canFilmAnalyze(grokStatus)
  const loginHint = project?.nextAction?.id === "grok_login" ? project.nextAction.message : ""
  const preflightError = preflight.error ? studioErrorMessage(preflight.error) : ""
  const analyzeGateLabel =
    preflight.isLoading && !grokStatus
      ? filmGrokCheckingLabel(runnerSource)
      : loginHint ||
        preflightError ||
        filmAnalyzeGateReason(grokStatus) ||
        (canAnalyze ? "" : filmGrokAuthLabel(grokStatus))
  const projectLocksSource = Boolean(
    project?.source || project?.executor?.source || project?.package?.source || project?.package?.executorSource,
  )
  const ready = Boolean(currentFilmUserId())
  const setFilmVpsAnalyzing = useLiveEventsGate((state) => state.setFilmVpsAnalyzing)
  useEffect(() => {
    setFilmVpsAnalyzing(ready && filmIsAnalyzing(project) && runnerSource === "vps")
    return () => setFilmVpsAnalyzing(false)
  }, [project, ready, runnerSource, setFilmVpsAnalyzing])

  async function refreshPreflight() {
    const result = await preflight.refetch()
    if (result.error) throw result.error
    return result.data
  }

  function handleRunnerSourceChange(next: FilmRunnerSource) {
    writeExecutorSourcePreference(next)
  }

  if (view === "canvas") {
    return (
      <div className="workspace film film-canvas-entry">
        <Suspense fallback={<p className="film-canvas-fallback">正在打开画布…</p>}>
          <WorkspaceShell onOpenClassic={() => setView("classic")} />
        </Suspense>
        {error ? <p className="film-stage-error">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="workspace film">
      <div className="film-toolbar">
        <FilmProjectSwitcher current={project} enabled />
        {hint ? <span className="film-phase">{hint}</span> : null}
        {busy ? <span className="film-phase-busy">进行中</span> : null}
        <button
          type="button"
          className="ghost-btn compact film-view-toggle"
          onClick={() => setView("canvas")}
        >
          打开画布
        </button>
        <FilmGrokStatus
          preflight={grokStatus ? { ...grokStatus, source: runnerSource } : grokStatus}
          loading={preflight.isFetching}
          error={preflightError || undefined}
          loginMessage={!canAnalyze ? loginHint : undefined}
          fallbackSource={runnerSource}
          onRecheck={() => {
            void preflight.refetch()
          }}
        />
      </div>
      <div className="film-stage">
        <FilmFollowPage
          project={project}
          canAnalyze={canAnalyze}
          analyzeGateLabel={analyzeGateLabel}
          grokStatus={grokStatus}
          preflightLoading={preflight.isFetching}
          preflightError={preflightError || undefined}
          loginMessage={loginHint || undefined}
          runnerSource={runnerSource}
          sourceLocked={projectLocksSource}
          onRunnerSourceChange={handleRunnerSourceChange}
          onRecheck={() => {
            void preflight.refetch()
          }}
          refreshPreflight={refreshPreflight}
        />
        {error ? <p className="film-stage-error">{error}</p> : null}
      </div>
    </div>
  )
}
