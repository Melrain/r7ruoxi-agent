import type { CanvasNodeData, NodeKind } from "@/components/film/canvas/types/project";
import { uploadFilmAsset } from "@/components/film/canvas/lib/upload-film-asset";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import {
  isAbortError,
  isTimeoutError,
  StudioApiError,
  studioErrorMessage,
} from "@/lib/api/client";
import { FILM_VIDEO_ACCEPT, isFilmVideoFile } from "@/lib/film-package";

const ACCEPT: Partial<Record<NodeKind, string>> = {
  file: "*/*",
  image: "image/*",
  // Align with Nest film.reference whitelist; include extensions so empty-mime .mov isn't killed by the picker.
  video: FILM_VIDEO_ACCEPT,
  audio: "audio/*",
};

export function isUploadKind(kind: NodeKind | undefined) {
  return kind === "file" || kind === "image" || kind === "video" || kind === "audio";
}

function revokeIfBlob(url?: string | null) {
  const u = url?.trim();
  if (u?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      // ignore
    }
  }
}


export function pickLocalFile(accept = "*/*"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Temporary local preview only — never treat as cloud truth (no assetId). */
async function localPreviewPatch(file: File): Promise<Partial<CanvasNodeData>> {
  const useData =
    file.size < 2_000_000 &&
    (file.type.startsWith("image/") || file.type.startsWith("audio/"));
  const assetUrl = useData
    ? await readAsDataUrl(file)
    : URL.createObjectURL(file);
  return {
    label: file.name,
    text: file.name,
    prompt: file.name,
    assetUrl,
    assetId: undefined,
    status: "success",
    progress: undefined,
    errorMessage: undefined,
  };
}

function uploadFailureMessage(error: unknown): string {
  if (isTimeoutError(error)) {
    return "上传超时，请重试或换小一点的视频（不超过 50MB）。";
  }
  if (error instanceof Error && /50MB|不能超过/.test(error.message)) {
    return error.message;
  }
  if (error instanceof StudioApiError && error.status === 401) {
    return "请先登录";
  }
  const raw = studioErrorMessage(error) || "";
  if (/401|unauthorized|未授权|未登录|请先登录/i.test(raw)) {
    return "请先登录";
  }
  return raw || "上传失败，请重试";
}

/**
 * kind 分流：
 * - video → uploading（可带本地 blob 预览）→ film.reference → R2 → assetId
 * - image/audio/file → 本地暂存预览 + toast「云端仅视频」
 */
export async function pickAndAttachAsset(
  nodeId: string,
  kind: NodeKind,
  update: (id: string, data: Partial<CanvasNodeData>) => void,
) {
  const current = useProjectStore.getState().nodes.find((n) => n.id === nodeId);
  if (current?.data.status === "uploading") {
    useProjectStore.getState().showToast("正在上传，请稍候");
    return false;
  }

  const file = await pickLocalFile(ACCEPT[kind] ?? "*/*");
  if (!file) return false;

  if (kind !== "video") {
    update(nodeId, await localPreviewPatch(file));
    useProjectStore
      .getState()
      .showToast("云端仅视频；图/音/文件先本地暂存，通用资产口未开");
    return true;
  }

  if (!isFilmVideoFile(file)) {
    useProjectStore
      .getState()
      .showToast("请选择视频文件（mp4 / mov / webm 等）");
    return false;
  }

  // Drop prior blob (failed attempt / stale preview) before attaching a new one.
  revokeIfBlob(current?.data.assetUrl);
  const localPreview = URL.createObjectURL(file);
  update(nodeId, {
    label: file.name,
    text: file.name,
    prompt: file.name,
    status: "uploading",
    progress: "上传中…",
    errorMessage: undefined,
    assetId: undefined,
    filmProjectId: undefined,
    assetUrl: localPreview,
  });

  try {
    const { assetId, assetUrl, filmProjectId } = await uploadFilmAsset(file);
    URL.revokeObjectURL(localPreview);
    update(nodeId, {
      label: file.name,
      text: file.name,
      prompt: file.name,
      assetId,
      assetUrl,
      filmProjectId,
      status: "success",
      progress: undefined,
      errorMessage: undefined,
    });
    return true;
  } catch (error) {
    if (isAbortError(error)) {
      URL.revokeObjectURL(localPreview);
      update(nodeId, {
        status: "idle",
        progress: undefined,
        errorMessage: undefined,
        assetId: undefined,
        filmProjectId: undefined,
        assetUrl: undefined,
      });
      return false;
    }
    const message = uploadFailureMessage(error);
    useProjectStore.getState().showToast(message);
    // Keep local blob so user still sees what failed; no assetId = not cloud truth.
    update(nodeId, {
      status: "error",
      progress: undefined,
      errorMessage: message,
      assetId: undefined,
      filmProjectId: undefined,
      assetUrl: localPreview,
    });
    return false;
  }
}
