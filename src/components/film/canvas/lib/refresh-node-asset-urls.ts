import { resolveLibraryAssets } from "@/lib/api/assets";
// TODO(transition): 旧节点可能仍存 film.reference id；assets/resolve 已兼容 film_reference Link。
// 若仍 miss，可临时回退 resolveFilmLibraryAssets（勿默认依赖）。
import { resolveFilmLibraryAssets } from "@/lib/api/film";
import { toBrowserMediaUrl } from "@/lib/media-url";
import { resolveAssetUrl } from "@/components/film/canvas/lib/resolve-asset-url";
import { useProjectStore } from "@/components/film/canvas/store/project-store";
import type { AppNode, CanvasNodeData } from "@/components/film/canvas/types/project";

const retryAttempted = new Set<string>();
const retryInFlight = new Set<string>();

function browserLibraryUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  return toBrowserMediaUrl(trimmed) ?? trimmed;
}

/** Missing cache, or http(s) presign that may be expired after refresh. */
export function nodeNeedsAssetUrlRefresh(data: CanvasNodeData): boolean {
  const assetId = data.assetId?.trim();
  if (!assetId) return false;
  const url = data.assetUrl?.trim();
  if (!url) return true;
  // Durable Nest rewrite paths do not need re-presign on hydrate.
  if (url.startsWith("/api/backend/") || url.startsWith("/internal/")) {
    return false;
  }
  // Presigned R2 URLs expire — refresh on hydrate when we have assetId.
  if (url.startsWith("https://") || url.startsWith("http://")) return true;
  return !resolveAssetUrl(url);
}

function collectRefreshTargets(
  nodes: AppNode[],
  nodeIds?: string[],
): Array<{ nodeId: string; assetId: string }> {
  const allow = nodeIds ? new Set(nodeIds) : null;
  const out: Array<{ nodeId: string; assetId: string }> = [];
  for (const node of nodes) {
    if (allow && !allow.has(node.id)) continue;
    if (!nodeNeedsAssetUrlRefresh(node.data)) continue;
    const assetId = node.data.assetId!.trim();
    out.push({ nodeId: node.id, assetId });
  }
  return out;
}

/**
 * Batch re-fetch readable URLs for nodes with assetId but missing/expired assetUrl.
 * Writes assetUrl back via updateNodeData. On failure keeps placeholder.
 */
export async function refreshNodeAssetUrls(options?: {
  nodeIds?: string[];
  signal?: AbortSignal;
}): Promise<{ refreshed: number; failed: number }> {
  const store = useProjectStore.getState();
  const targets = collectRefreshTargets(store.nodes, options?.nodeIds);
  if (targets.length === 0) return { refreshed: 0, failed: 0 };

  const assetIds = [...new Set(targets.map((t) => t.assetId))];
  let items: Array<{ assetId: string; url: string }> = [];
  try {
    const result = await resolveLibraryAssets(assetIds, {
      signal: options?.signal,
    });
    items = result.items ?? [];
    const hit = new Set(items.map((i) => i.assetId?.trim()).filter(Boolean));
    const missing = assetIds.filter((id) => !hit.has(id));
    // TODO(transition): 未回填 / 无 Asset Link 的旧 film library id
    if (missing.length > 0) {
      try {
        const fallback = await resolveFilmLibraryAssets(missing, {
          signal: options?.signal,
        });
        items = [...items, ...(fallback.items ?? [])];
      } catch {
        // keep assets-side hits only
      }
    }
  } catch {
    // 全局 resolve 不可用时再试旧 film/library/resolve（过渡）
    try {
      const result = await resolveFilmLibraryAssets(assetIds, {
        signal: options?.signal,
      });
      items = result.items ?? [];
    } catch {
      return { refreshed: 0, failed: targets.length };
    }
  }
  if (options?.signal?.aborted) {
    return { refreshed: 0, failed: 0 };
  }

  const urlByAsset = new Map(
    items
      .map((item) => {
        const assetId = item.assetId?.trim();
        const url = browserLibraryUrl(item.url ?? "");
        return assetId && url ? ([assetId, url] as const) : null;
      })
      .filter((row): row is readonly [string, string] => Boolean(row)),
  );

  let refreshed = 0;
  let failed = 0;
  for (const target of targets) {
    const url = urlByAsset.get(target.assetId);
    if (!url) {
      failed += 1;
      continue;
    }
    store.updateNodeData(target.nodeId, { assetUrl: url });
    refreshed += 1;
  }
  return { refreshed, failed };
}

/**
 * On media onError: resolve once per nodeId and patch assetUrl.
 * Returns true if a new URL was written (caller should wait for re-render),
 * false if failed / already attempted (caller may show placeholder).
 * Returns null while another retry is in flight (do not mark broken yet).
 */
export async function retryNodeAssetUrlOnError(
  nodeId: string,
): Promise<boolean | null> {
  if (retryInFlight.has(nodeId)) return null;
  if (retryAttempted.has(nodeId)) return false;

  const store = useProjectStore.getState();
  const node = store.nodes.find((n) => n.id === nodeId);
  const assetId = node?.data.assetId?.trim();
  if (!assetId) return false;

  retryInFlight.add(nodeId);
  retryAttempted.add(nodeId);
  try {
    let hitUrl = "";
    try {
      const result = await resolveLibraryAssets([assetId]);
      const hit = result.items?.find((item) => item.assetId === assetId);
      hitUrl = hit?.url?.trim() || "";
    } catch {
      hitUrl = "";
    }
    // TODO(transition): assets miss → 旧 film/library/resolve
    if (!hitUrl) {
      try {
        const result = await resolveFilmLibraryAssets([assetId]);
        const hit = result.items?.find((item) => item.assetId === assetId);
        hitUrl = hit?.url?.trim() || "";
      } catch {
        hitUrl = "";
      }
    }
    const url = hitUrl ? browserLibraryUrl(hitUrl) : "";
    if (!url) return false;
    store.updateNodeData(nodeId, { assetUrl: url });
    return true;
  } catch {
    return false;
  } finally {
    retryInFlight.delete(nodeId);
  }
}

/** Test helper / reset after successful manual re-upload. */
export function clearAssetUrlRetryAttempts(nodeId?: string) {
  if (nodeId) {
    retryAttempted.delete(nodeId);
    retryInFlight.delete(nodeId);
    return;
  }
  retryAttempted.clear();
  retryInFlight.clear();
}
