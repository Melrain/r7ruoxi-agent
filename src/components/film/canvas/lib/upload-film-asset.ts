import {
  addFilmReference,
  createFilmProject,
  getFilmProject,
  listFilmProjects,
  openFilmProject,
  type FilmProjectSummary,
  type FilmReference,
} from "@/lib/api/film";
import { FILM_MAX_UPLOAD_BYTES } from "@/lib/film-package";

export type UploadedFilmAsset = {
  /** Nest film.reference id — use for analyzeFilmReference. */
  assetId: string;
  assetUrl?: string;
  /** Nest FilmProject that owns this reference. */
  filmProjectId: string;
};

const CANVAS_FILM_PROJECT_KEY = "canvas-workspace.film-project-id";
/** Dedicated Nest film project for canvas video uploads — do not steal classic current. */
const CANVAS_PROJECT_TITLE = "画布";

function httpsUrl(value?: string): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  return undefined;
}

function pickUploadedReference(
  references: FilmReference[],
  fileName: string,
): FilmReference | undefined {
  if (references.length === 0) return undefined;
  const needle = fileName.trim();
  const byName = [...references]
    .reverse()
    .find((ref) => (ref.title?.trim() || "") === needle);
  if (byName) return byName;
  return references[references.length - 1];
}

function readStoredCanvasProjectId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const id = window.localStorage.getItem(CANVAS_FILM_PROJECT_KEY)?.trim();
    return id || undefined;
  } catch {
    return undefined;
  }
}

function writeStoredCanvasProjectId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CANVAS_FILM_PROJECT_KEY, id);
  } catch {
    // quota / private mode — upload still works for this session
  }
}

export function mostRecentlyOpenedId(projects: FilmProjectSummary[]): string | undefined {
  if (projects.length === 0) return undefined;
  const sorted = [...projects].sort(
    (a, b) => Date.parse(b.lastOpenedAt ?? b.updatedAt ?? "") - Date.parse(a.lastOpenedAt ?? a.updatedAt ?? ""),
  );
  return sorted[0]?.id;
}

/**
 * Resolve a dedicated 「画布」 film project id for canvas uploads.
 * Avoids getCurrentFilmProject (would append into classic package).
 * create/addReference bump Nest lastOpenedAt — caller should restore classic.
 */
export async function resolveCanvasFilmProject(options?: {
  signal?: AbortSignal;
}): Promise<{ projectId: string; previousCurrentId?: string }> {
  const listed = await listFilmProjects({ signal: options?.signal }).catch(
    () => [] as FilmProjectSummary[],
  );
  const previousCurrentId = mostRecentlyOpenedId(listed);

  const stored = readStoredCanvasProjectId();
  if (stored) {
    const inList = listed.find((p) => p.id === stored);
    if (inList) {
      return { projectId: inList.id, previousCurrentId };
    }
    const alive = await getFilmProject(stored, {
      signal: options?.signal,
    }).catch(() => undefined);
    if (alive?.id) {
      return { projectId: alive.id, previousCurrentId };
    }
  }

  const byTitle = listed.find(
    (p) => p.title?.trim() === CANVAS_PROJECT_TITLE && p.status === "active",
  );
  if (byTitle?.id) {
    writeStoredCanvasProjectId(byTitle.id);
    return { projectId: byTitle.id, previousCurrentId };
  }

  const created = await createFilmProject(CANVAS_PROJECT_TITLE, {
    signal: options?.signal,
  });
  if (!created?.id) {
    throw new Error("无法创建画布项目，请重试。");
  }
  writeStoredCanvasProjectId(created.id);
  return { projectId: created.id, previousCurrentId };
}

/** Nest writePackageRecord bumps lastOpenedAt — put classic back if we stole it. */
export async function restoreClassicCurrent(
  previousCurrentId: string | undefined,
  canvasProjectId: string,
  signal?: AbortSignal,
) {
  if (!previousCurrentId || previousCurrentId === canvasProjectId) return;
  await openFilmProject(previousCurrentId, { signal }).catch(() => undefined);
}

/**
 * Find which FilmProject owns this reference id.
 * Prefer hint (upload / library projectId), then stored 「画布」, then scan.
 */
export async function resolveFilmProjectForReference(
  refId: string,
  options?: {
    signal?: AbortSignal;
    preferredProjectId?: string;
  },
): Promise<{ projectId: string; previousCurrentId?: string }> {
  const needle = refId.trim();
  if (!needle) {
    throw new Error("输入资产未入库（缺 assetId），请重新上传视频");
  }

  const listed = await listFilmProjects({ signal: options?.signal }).catch(
    () => [] as FilmProjectSummary[],
  );
  const previousCurrentId = mostRecentlyOpenedId(listed);

  const candidates: string[] = [];
  const push = (id?: string) => {
    const v = id?.trim();
    if (!v || candidates.includes(v)) return;
    candidates.push(v);
  };
  push(options?.preferredProjectId);
  push(readStoredCanvasProjectId());
  for (const p of listed) {
    if (p.title?.trim() === CANVAS_PROJECT_TITLE && p.status !== "archived") {
      push(p.id);
    }
  }
  for (const p of listed) push(p.id);

  for (const projectId of candidates) {
    const thread = await getFilmProject(projectId, {
      signal: options?.signal,
    }).catch(() => undefined);
    const hit = thread?.package?.references?.some(
      (ref) => ref.id?.trim() === needle,
    );
    if (hit) {
      // Keep canvas uploads pinned when we landed on the dedicated project.
      if (thread?.title?.trim() === CANVAS_PROJECT_TITLE) {
        writeStoredCanvasProjectId(projectId);
      }
      return { projectId, previousCurrentId };
    }
  }

  throw new Error(
    "参考片不在可访问的影片项目中（assetId 可能是素材库 id 而非参考片）。请在画布重新上传视频后再跑视频解析。",
  );
}

/** Upload video as film.reference on dedicated 「画布」 project (Nest → R2). */
export async function uploadFilmAsset(
  file: File,
  options?: { signal?: AbortSignal },
): Promise<UploadedFilmAsset> {
  if (file.size > FILM_MAX_UPLOAD_BYTES) {
    throw new Error("视频不能超过 50MB。");
  }

  const { projectId, previousCurrentId } = await resolveCanvasFilmProject(
    options,
  );

  try {
    const form = new FormData();
    form.append("file", file);
    const thread = await addFilmReference(projectId, form, {
      signal: options?.signal,
    });

    const ref = pickUploadedReference(
      thread.package?.references ?? [],
      file.name,
    );
    const assetId = ref?.id?.trim();
    if (!assetId) {
      throw new Error("上传成功但未返回资产编号，请重试。");
    }

    const assetUrl =
      httpsUrl(ref?.mediaUrl) ?? httpsUrl(ref?.url) ?? undefined;

    return assetUrl
      ? { assetId, assetUrl, filmProjectId: projectId }
      : { assetId, filmProjectId: projectId };
  } finally {
    await restoreClassicCurrent(
      previousCurrentId,
      projectId,
      options?.signal,
    );
  }
}
