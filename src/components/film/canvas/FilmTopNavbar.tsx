"use client"

import { useMemo } from "react"
import { ProjectSwitcher } from "@/components/film/canvas/ProjectSwitcher"
import { VpsProbeBar } from "@/components/film/canvas/VpsProbeBar"
import { useFilmCurrentProject, useFilmProjects } from "@/hooks/use-film-project"
import { filmPhaseLabel } from "@/lib/film-package"
import { cn } from "@/lib/utils"

/**
 * Desktop stand-in for web TopNavbar + /video list density.
 * Shell still has global sidebar/topbar — this is the in-canvas dense strip.
 */
export function FilmTopNavbar() {
  const current = useFilmCurrentProject(true)
  const list = useFilmProjects(true)
  const projects = useMemo(() => {
    const items = Array.isArray(list.data) ? list.data : []
    return items.slice(0, 12)
  }, [list.data])

  return (
    <div className="pointer-events-auto absolute inset-x-3 top-3 z-50 flex min-w-0 items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <ProjectSwitcher />
        </div>
        {projects.length > 0 ? (
          <ul className="flex max-w-[min(720px,62vw)] flex-wrap gap-1">
            {projects.map((item) => (
              <li key={item.id}>
                <span
                  className={cn(
                    "inline-flex max-w-[140px] items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-tight",
                    item.id === current.data?.id
                      ? "border-[#e8c27a]/40 bg-[#e8c27a]/12 text-[#e8c27a]"
                      : "border-white/8 bg-black/25 text-zinc-400",
                  )}
                  title={item.title}
                >
                  <span className="truncate">{item.title}</span>
                  {item.phase ? (
                    <span className="shrink-0 text-[9px] text-zinc-500">
                      {filmPhaseLabel(item.phase)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <VpsProbeBar className="inline-flex shrink-0" />
    </div>
  )
}
