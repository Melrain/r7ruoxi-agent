import type {
  ProjectDoc,
  ProjectMeta,
} from "@/components/film/canvas/types/project";

export type { ProjectMeta };

/** Legacy single-doc key — migrated into project library on first hydrate. */
export const STORAGE_KEY = "canvas-workspace.project.v4";
export const STORAGE_VERSION = 4;

const INDEX_KEY = "canvas-workspace.projects.index.v1";
const CURRENT_KEY = "canvas-workspace.projects.current.v1";

function docKey(id: string) {
  return `canvas-workspace.projects.doc.v1.${id}`;
}

function isEphemeralAssetUrl(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:");
}

function isDurableAssetUrl(url: string) {
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    // Studio / Nest media via Next rewrite — not ephemeral.
    url.startsWith("/api/backend/")
  );
}

/** Strip blob:/data:; keep assetId; may keep https|/api/backend assetUrl as cache. */
function dropHeavyMedia(doc: ProjectDoc, dropHttpsCache = false): ProjectDoc {
  return {
    ...doc,
    nodes: doc.nodes.map((node) => {
      const url = node.data.assetUrl;
      if (!url) return node;
      if (isEphemeralAssetUrl(url) || dropHttpsCache) {
        return { ...node, data: { ...node.data, assetUrl: undefined } };
      }
      if (isDurableAssetUrl(url)) return node;
      return { ...node, data: { ...node.data, assetUrl: undefined } };
    }),
  };
}

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseDoc(raw: string): ProjectDoc | null {
  try {
    const parsed = JSON.parse(raw) as ProjectDoc;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.nodes)) {
      return null;
    }
    return dropHeavyMedia(parsed);
  } catch {
    return null;
  }
}

function readIndex(): { currentId: string | null; projects: ProjectMeta[] } {
  if (typeof window === "undefined") return { currentId: null, projects: [] };
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const currentId = window.localStorage.getItem(CURRENT_KEY);
    if (!raw) return { currentId, projects: [] };
    const parsed = JSON.parse(raw) as ProjectMeta[];
    if (!Array.isArray(parsed)) return { currentId, projects: [] };
    return { currentId, projects: parsed };
  } catch {
    return { currentId: null, projects: [] };
  }
}

function writeIndex(projects: ProjectMeta[], currentId: string | null) {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(projects));
  if (currentId) window.localStorage.setItem(CURRENT_KEY, currentId);
  else window.localStorage.removeItem(CURRENT_KEY);
}

export function listProjects(): ProjectMeta[] {
  return readIndex()
    .projects.slice()
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCurrentProjectId(): string | null {
  return readIndex().currentId;
}

export function loadProjectDoc(id: string): ProjectDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(docKey(id));
    if (!raw) return null;
    return parseDoc(raw);
  } catch {
    return null;
  }
}

export function saveProjectDoc(
  id: string,
  doc: ProjectDoc,
  title?: string,
): boolean {
  if (typeof window === "undefined") return false;
  const light = dropHeavyMedia(doc);
  try {
    window.localStorage.setItem(docKey(id), JSON.stringify(light));
  } catch {
    try {
      window.localStorage.setItem(
        docKey(id),
        JSON.stringify(dropHeavyMedia(doc, true)),
      );
    } catch {
      return false;
    }
  }
  const { projects } = readIndex();
  const nextTitle =
    title?.trim() || light.workspaceTitle || light.canvasName || "未命名影片";
  const now = Date.now();
  const idx = projects.findIndex((p) => p.id === id);
  const meta: ProjectMeta = { id, title: nextTitle, updatedAt: now };
  const next =
    idx >= 0 ? projects.map((p, i) => (i === idx ? meta : p)) : [meta, ...projects];
  writeIndex(next, id);
  // keep legacy single-key mirror for old hydrate paths
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
  } catch {
    /* ignore */
  }
  return true;
}

export function createProjectMeta(title = "未命名影片"): ProjectMeta {
  return { id: uid(), title, updatedAt: Date.now() };
}

export function renameProjectMeta(id: string, title: string): boolean {
  const { projects, currentId } = readIndex();
  const nextTitle = title.trim() || "未命名影片";
  const next = projects.map((p) =>
    p.id === id ? { ...p, title: nextTitle, updatedAt: Date.now() } : p,
  );
  writeIndex(next, currentId);
  const doc = loadProjectDoc(id);
  if (doc) {
    saveProjectDoc(
      id,
      { ...doc, workspaceTitle: nextTitle, canvasName: nextTitle },
      nextTitle,
    );
  }
  return true;
}

export function deleteProjectMeta(id: string): string | null {
  const { projects, currentId } = readIndex();
  const next = projects.filter((p) => p.id !== id);
  window.localStorage.removeItem(docKey(id));
  let nextCurrent = currentId;
  if (currentId === id) {
    nextCurrent = next[0]?.id ?? null;
  }
  writeIndex(next, nextCurrent);
  return nextCurrent;
}

/** Migrate legacy single-doc storage into project library. */
export function ensureProjectLibrary(seedDoc: ProjectDoc): {
  currentId: string;
  doc: ProjectDoc;
  projects: ProjectMeta[];
} {
  const { projects, currentId } = readIndex();
  if (currentId && projects.some((p) => p.id === currentId)) {
    const doc = loadProjectDoc(currentId) ?? seedDoc;
    return { currentId, doc, projects: listProjects() };
  }
  if (projects[0]) {
    const id = projects[0].id;
    writeIndex(projects, id);
    return {
      currentId: id,
      doc: loadProjectDoc(id) ?? seedDoc,
      projects: listProjects(),
    };
  }
  // legacy v4 single key
  const legacy = loadProject();
  const meta = createProjectMeta(
    legacy?.workspaceTitle ||
      legacy?.canvasName ||
      seedDoc.workspaceTitle ||
      "未命名影片",
  );
  const doc = legacy ?? seedDoc;
  saveProjectDoc(meta.id, doc, meta.title);
  return { currentId: meta.id, doc, projects: listProjects() };
}

export function loadProject(): ProjectDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseDoc(raw);
  } catch {
    return null;
  }
}

export function saveProject(doc: ProjectDoc): boolean {
  const id = getCurrentProjectId();
  if (id) return saveProjectDoc(id, doc, doc.workspaceTitle);
  if (typeof window === "undefined") return false;
  const light = dropHeavyMedia(doc);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    return true;
  } catch {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(dropHeavyMedia(doc, true)),
      );
      return true;
    } catch {
      return false;
    }
  }
}

export function clearProject() {
  if (typeof window === "undefined") return;
  const id = getCurrentProjectId();
  if (id) window.localStorage.removeItem(docKey(id));
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem("canvas-workspace.project.v1");
  window.localStorage.removeItem("canvas-workspace.project.v2");
  window.localStorage.removeItem("canvas-workspace.project.v3");
}
