import { backendFetch, StudioApiError } from "@/lib/api/client"
import { type FilmBreakdownItem, type FilmScript } from "@/lib/film-package"
import { requireProjectFromUnknown, type FilmProject } from "@/lib/api/film"

import {
  missingFilmEndpointMessage,
  type FilmWriteFeature,
} from "@/lib/film-fail-closed"

export type { FilmWriteFeature }
export { missingFilmEndpointMessage }

function projectPath(projectId: string, suffix: string) {
  return `/api/backend/internal/film/projects/${encodeURIComponent(projectId)}${suffix}`
}

function wrapMissing(feature: FilmWriteFeature, error: unknown): never {
  if (error instanceof StudioApiError && (error.status === 404 || error.status === 501)) {
    throw new StudioApiError(missingFilmEndpointMessage(feature), error.status, error.code)
  }
  throw error
}

export type FilmWriteScriptInput = {
  skillId?: string
  promptSupplement?: string
  /** write-script vision：参考图/帧 assetId */
  visionAssetIds?: string[]
}

export type FilmWriteStoryboardInput = {
  skillId?: string
  promptSupplement?: string
}

const WRITE_TIMEOUT_MS = 380_000

async function postProjectAction(
  projectId: string,
  suffix: string,
  body: Record<string, unknown>,
  options?: { signal?: AbortSignal },
): Promise<FilmProject> {
  const payload = Object.fromEntries(
    Object.entries(body).filter(([, value]) => {
      if (value == null) return false
      if (typeof value === "string" && !value.trim()) return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    }),
  )
  return requireProjectFromUnknown(
    await backendFetch<unknown>(projectPath(projectId, suffix), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: WRITE_TIMEOUT_MS,
      signal: options?.signal,
    }),
  )
}

export async function writeFilmScript(
  projectId: string,
  input: FilmWriteScriptInput = {},
  options?: { signal?: AbortSignal },
): Promise<FilmProject> {
  try {
    return await postProjectAction(
      projectId,
      "/write-script",
      {
        skillId: input.skillId,
        promptSupplement: input.promptSupplement,
        visionAssetIds: input.visionAssetIds,
      },
      options,
    )
  } catch (error) {
    wrapMissing("write-script", error)
  }
}

export async function writeFilmStoryboard(
  projectId: string,
  input: FilmWriteStoryboardInput = {},
  options?: { signal?: AbortSignal },
): Promise<FilmProject> {
  try {
    return await postProjectAction(
      projectId,
      "/write-storyboard",
      {
        skillId: input.skillId,
        promptSupplement: input.promptSupplement,
      },
      options,
    )
  } catch (error) {
    wrapMissing("write-storyboard", error)
  }
}

export async function runNextFilmStage(
  projectId: string,
  options?: { signal?: AbortSignal },
): Promise<FilmProject> {
  try {
    return await postProjectAction(projectId, "/run-next", {}, options)
  } catch (error) {
    wrapMissing("run-next", error)
  }
}

export function requireFilmScriptBody(project: FilmProject): FilmScript {
  const script = project.package?.script
  const body = script?.body?.trim() ?? ""
  if (!body) {
    throw new StudioApiError("写剧本没有返回正文，无法假装成功")
  }
  return {
    id: script?.id ?? "",
    title: script?.title?.trim() || "剧本",
    body,
  }
}

export function storyboardRowsFromProject(project: FilmProject): FilmBreakdownItem[] {
  const items = project.package?.breakdown ?? []
  const shots = items.filter((item) => {
    const kind = (item.kind ?? "").toLowerCase()
    return kind === "shot" || Boolean(item.shotNo || item.visual || item["画面"])
  })
  const rows = shots.length > 0 ? shots : items
  if (rows.length === 0) {
    throw new StudioApiError("写分镜没有返回镜号，无法假装成功")
  }
  return rows
}

