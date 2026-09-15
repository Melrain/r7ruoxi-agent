import { backendFetch } from "@/lib/api/client"

export const ASSET_DOMAINS = ["all", "film", "recruit", "makeup"] as const
export type AssetDomainFilter = (typeof ASSET_DOMAINS)[number]
export type AssetUploadDomain = Exclude<AssetDomainFilter, "all">

export const ASSET_KINDS = ["all", "image", "video", "audio", "file"] as const
export type AssetKindFilter = (typeof ASSET_KINDS)[number]
export type AssetKind = Exclude<AssetKindFilter, "all">

export type LibraryAsset = {
  id: string
  kind: AssetKind
  title: string
  filename: string | null
  mimeType: string | null
  byteSize: number | null
  source: string
  status: string
  createdAt: string
  url: string
  linkCount: number
  domains: AssetUploadDomain[]
  /** film 双写 Link(film_reference).refId；画布 analyze 优先用。 */
  filmReferenceId?: string
  /** Asset.meta.filmProjectId */
  filmProjectId?: string
}

export type LibraryAssetPage = {
  items: LibraryAsset[]
  nextCursor?: string
}

/** 全局资产库列表：读 Asset(+Link)，非 ListObjects。 */
export async function listLibraryAssets(options?: {
  domain?: AssetDomainFilter
  kind?: AssetKindFilter
  cursor?: string
  limit?: number
  signal?: AbortSignal
}) {
  const params = new URLSearchParams()
  if (options?.domain && options.domain !== "all") {
    params.set("domain", options.domain)
  } else if (options?.domain === "all") {
    params.set("domain", "all")
  }
  if (options?.kind && options.kind !== "all") {
    params.set("kind", options.kind)
  } else if (options?.kind === "all") {
    params.set("kind", "all")
  }
  if (options?.cursor) params.set("cursor", options.cursor)
  if (options?.limit !== undefined) params.set("limit", String(options.limit))
  const qs = params.toString()
  return backendFetch<LibraryAssetPage>(
    `/api/backend/internal/assets${qs ? `?${qs}` : ""}`,
    {
      timeoutMs: 30_000,
      signal: options?.signal,
    },
  )
}

export async function uploadLibraryAssets(
  files: File[],
  domain: AssetUploadDomain,
  options?: { signal?: AbortSignal },
) {
  const form = new FormData()
  form.set("domain", domain)
  for (const file of files) {
    form.append("files", file)
  }
  return backendFetch<{ items: LibraryAsset[] }>(
    "/api/backend/internal/assets",
    {
      method: "POST",
      body: form,
      timeoutMs: 120_000,
      signal: options?.signal,
    },
  )
}

/** 多引用：只软摘 Link。 */
export async function unlinkLibraryAsset(
  assetId: string,
  domain?: AssetUploadDomain,
  options?: { signal?: AbortSignal },
) {
  return backendFetch<{ ok: true; linkCount: number; action: "unlinked" }>(
    `/api/backend/internal/assets/${encodeURIComponent(assetId)}/unlink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain ? { domain } : {}),
      timeoutMs: 15_000,
      signal: options?.signal,
    },
  )
}

/** 引用 ≤1：软删 Asset；>1 时后端 409。 */
export async function softDeleteLibraryAsset(
  assetId: string,
  options?: { signal?: AbortSignal },
) {
  return backendFetch<{ ok: true; action: "soft_deleted" }>(
    `/api/backend/internal/assets/${encodeURIComponent(assetId)}`,
    {
      method: "DELETE",
      timeoutMs: 15_000,
      signal: options?.signal,
    },
  )
}

export type LibraryAssetResolveItem = {
  assetId: string
  url: string
}

export type LibraryAssetResolveResult = {
  items: LibraryAssetResolveItem[]
}

/** 批量重签可读 URL：Asset.id，或过渡期 film_reference refId。 */
export async function resolveLibraryAssets(
  assetIds: string[],
  options?: { signal?: AbortSignal },
) {
  const ids = [
    ...new Set(
      assetIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    ),
  ]
  if (ids.length === 0) return { items: [] as LibraryAssetResolveItem[] }
  return backendFetch<LibraryAssetResolveResult>(
    "/api/backend/internal/assets/resolve",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds: ids }),
      timeoutMs: 30_000,
      signal: options?.signal,
    },
  )
}
