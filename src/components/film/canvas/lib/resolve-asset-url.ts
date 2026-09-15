/**
 * Prefer durable http(s) assetUrl cache. Never treat blob:/data: as truth
 * for persistence / cloud identity — use assetId for that.
 */
export function resolveAssetUrl(assetUrl?: string | null): string | undefined {
  const url = assetUrl?.trim();
  if (!url) return undefined;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  return undefined;
}

/**
 * In-session UI src: durable http(s), local blob/data preview, demo svg posters.
 * Persist still strips blob/data; refresh keeps only http(s) (+ assetId).
 */
export function resolveMediaSrc(assetUrl?: string | null): string | undefined {
  const url = assetUrl?.trim();
  if (!url) return undefined;
  if (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("/api/backend/")
  ) {
    return url;
  }
  return undefined;
}
