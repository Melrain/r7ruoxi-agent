"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  Video,
  Volume2,
} from "lucide-react"
import {
  listLibraryAssets,
  resolveLibraryAssets,
  type AssetDomainFilter,
  type AssetKind,
  type LibraryAsset,
} from "@/lib/api/assets"
import { toBrowserMediaUrl } from "@/lib/media-url"
import { cn } from "@/lib/utils"
import { useProjectStore } from "@/components/film/canvas/store/project-store"
import type { AssetKind as CanvasAssetKind } from "@/components/film/canvas/types/project"

/** 与 /assets 一致：跨域只读选用。默认「全部」。 */
const DOMAIN_TABS: { id: AssetDomainFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "film", label: "影片" },
  { id: "recruit", label: "招聘" },
  { id: "makeup", label: "妆造" },
]

const KIND_TABS: { id: AssetKind; label: string }[] = [
  { id: "video", label: "视频" },
  { id: "image", label: "图片" },
  { id: "audio", label: "音频" },
  { id: "file", label: "文件" },
]

const DEFAULT_KIND: AssetKind = "video"

function libraryUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed
  }
  return toBrowserMediaUrl(trimmed) ?? trimmed
}

/** 与 /assets 一致：title || filename；跳过字面「未命名」。 */
function assetLabel(item: LibraryAsset) {
  const title = item.title?.trim()
  if (title && title !== "未命名") return title
  const filename = item.filename?.trim()
  if (filename) return filename
  return title || "未命名"
}

/**
 * 放入画布：
 * - assetId：优先 film_reference（兼容 analyze），否则全局 Asset.id
 * - filmProjectId：双写 meta 有则带上
 * - assetUrl：list 已带 presign
 */
function placeLibraryAsset(item: LibraryAsset) {
  const kind = item.kind as CanvasAssetKind
  const url = libraryUrl(item.url ?? "")
  const store = useProjectStore.getState()
  const globalId = item.id?.trim()
  const filmRefId = item.filmReferenceId?.trim()
  const assetId = filmRefId || globalId
  if (!assetId) {
    store.showToast("素材缺少 id，无法放入画布")
    return null
  }
  const filmProjectId = item.filmProjectId?.trim() || undefined
  const label = assetLabel(item)
  const id = store.addNode(kind, {
    data: {
      assetId,
      filmProjectId,
      assetUrl: url || undefined,
      label: label !== "未命名" ? label : undefined,
      status: "success",
    },
  })
  store.showToast(
    url
      ? `已放入${label}`
      : `已放入${label}（无预览地址）`,
  )
  return id
}

function KindIcon({ kind }: { kind: AssetKind }) {
  if (kind === "audio") return <Volume2 className="size-4 text-zinc-500" />
  if (kind === "image") return <ImageIcon className="size-4 text-zinc-500" />
  if (kind === "video") return <Video className="size-4 text-zinc-500" />
  return <FileText className="size-4 text-zinc-500" />
}

/** Once per assetId: avoid infinite resign when re-signed URL still 404s. */
const sheetResignAttempted = new Set<string>()

function Thumb({
  item,
  onUrlResigned,
  onResignFailed,
}: {
  item: LibraryAsset
  onUrlResigned: (assetId: string, url: string) => void
  onResignFailed: (label: string) => void
}) {
  const [src, setSrc] = useState(() => libraryUrl(item.url ?? ""))
  const [broken, setBroken] = useState(false)
  const resigning = useRef(false)

  useEffect(() => {
    setSrc(libraryUrl(item.url ?? ""))
    // Only reset broken UI when the list row identity/url externally changes;
    // do not clear sheetResignAttempted — that is what stops the 404 loop.
    setBroken(false)
    resigning.current = false
  }, [item.url, item.id])

  const markBroken = useCallback(
    (toast: boolean) => {
      setBroken(true)
      resigning.current = false
      if (toast) {
        onResignFailed(assetLabel(item))
      }
    },
    [item, onResignFailed],
  )

  const onMediaError = useCallback(() => {
    if (broken || resigning.current) {
      markBroken(false)
      return
    }
    const id = item.id?.trim()
    if (!id) {
      markBroken(true)
      return
    }
    // Already attempted resolve for this id → stop (no infinite loop)
    if (sheetResignAttempted.has(id)) {
      markBroken(true)
      return
    }
    sheetResignAttempted.add(id)
    resigning.current = true
    // 与 /assets Thumb 一致：单条 resolve，不整表 refetch；每 id 最多一次
    void resolveLibraryAssets([id])
      .then((result) => {
        const next = result.items
          .find((row) => row.assetId === id)
          ?.url?.trim()
        if (next) {
          setSrc(libraryUrl(next))
          onUrlResigned(id, next)
          resigning.current = false
          // Keep id in sheetResignAttempted: if next URL still 404s, onError → markBroken
          return
        }
        markBroken(true)
      })
      .catch(() => {
        markBroken(true)
      })
  }, [broken, item.id, markBroken, onUrlResigned])

  if ((item.kind === "image" || item.kind === "video") && src && !broken) {
    if (item.kind === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={onMediaError}
        />
      )
    }
    return (
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        onError={onMediaError}
        className="size-full object-cover"
      />
    )
  }
  return <KindIcon kind={item.kind} />
}

export function AssetLibrarySheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const showToast = useProjectStore((s) => s.showToast)
  const [domain, setDomain] = useState<AssetDomainFilter>("all")
  const [kind, setKind] = useState<AssetKind>(DEFAULT_KIND)
  const [items, setItems] = useState<LibraryAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patchItemUrl = useCallback((assetId: string, url: string) => {
    const id = assetId.trim()
    const nextUrl = url.trim()
    if (!id || !nextUrl) return
    setItems((prev) =>
      prev.map((row) => (row.id === id ? { ...row, url: nextUrl } : row)),
    )
  }, [])

  const load = useCallback(
    async (opts: {
      domain: AssetDomainFilter
      kind: AssetKind
      cursor?: string
      append?: boolean
      signal?: AbortSignal
    }) => {
      const append = Boolean(opts.append)
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        // 与 /assets 同源：listLibraryAssets → /internal/assets（Asset+Link）
        const page = await listLibraryAssets({
          domain: opts.domain,
          kind: opts.kind,
          cursor: opts.cursor,
          limit: 30,
          signal: opts.signal,
        })
        if (opts.signal?.aborted) return
        setItems((prev) => (append ? [...prev, ...page.items] : page.items))
        setNextCursor(page.nextCursor)
      } catch (err) {
        if (opts.signal?.aborted) return
        if (
          (typeof DOMException !== "undefined" &&
            err instanceof DOMException &&
            err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return
        }
        const message =
          err instanceof Error ? err.message : "加载资产库失败"
        setError(message)
        if (!append) setItems([])
        showToast(message)
      } finally {
        if (!opts.signal?.aborted) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [showToast],
  )

  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    void load({ domain, kind, signal: ac.signal })
    return () => ac.abort()
  }, [open, domain, kind, load])

  const switchDomain = (next: AssetDomainFilter) => {
    if (next === domain) return
    // 切换域名：重置 kind + 分页（items/cursor 由 load 刷新）
    setDomain(next)
    setKind(DEFAULT_KIND)
    setNextCursor(undefined)
    setItems([])
  }

  if (!open) return null

  if (typeof document === "undefined") return null

  const domainLabel =
    DOMAIN_TABS.find((t) => t.id === domain)?.label ?? "全部"
  const kindLabel = KIND_TABS.find((t) => t.id === kind)?.label ?? "素材"

  return createPortal(
    <div
      className="fixed inset-0 z-40"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      {/* Soft dim only — click empty to close. BottomBar is z-50 so +/zoom stay usable. */}
      <div className="absolute inset-0 bg-black/25" aria-hidden />
      <div
        className="absolute bottom-[4.75rem] left-1/2 z-10 flex w-[min(420px,calc(100vw-1.5rem))] max-h-[min(360px,42vh)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[#e8c27a]/15 bg-[#16130f]/95 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md sm:bottom-[5.25rem] sm:max-h-[min(400px,48vh)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="资产库"
      >
        <div className="flex items-center justify-between border-b border-white/6 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[13px] text-zinc-200">
            <FolderOpen className="size-3.5 text-[#e8c27a]" />
            资产库
            <span className="text-[11px] text-zinc-600">{domainLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] text-zinc-600"
              title="桌面端暂无独立资产库管理页"
            >
              资产库选用
            </span>
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-white/6 hover:text-zinc-300"
              onClick={() => onOpenChange(false)}
            >
              关闭
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-white/6 px-2 py-1.5">
          {DOMAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchDomain(tab.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px]",
                domain === tab.id
                  ? "bg-[#e8c27a]/15 text-[#e8c27a]"
                  : "text-zinc-500 hover:bg-white/6 hover:text-zinc-300",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border-b border-white/6 px-2 py-1.5">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === kind) return
                setKind(tab.id)
                setNextCursor(undefined)
                setItems([])
              }}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px]",
                kind === tab.id
                  ? "bg-[#e8c27a]/15 text-[#e8c27a]"
                  : "text-zinc-500 hover:bg-white/6 hover:text-zinc-300",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              加载中…
            </div>
          ) : error && items.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-red-300/80">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="space-y-1.5 px-2 py-8 text-center text-[12px] text-zinc-600">
              <p>
                暂无{domain === "all" ? "" : domainLabel}
                {kindLabel}
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-700">
                列表来自全局 Asset（可切换域名）。历史未回填的项不会出现；可去资产库管理上传，或等待回填后再选。
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      placeLibraryAsset(item)
                      onOpenChange(false)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 text-left hover:border-white/8 hover:bg-white/5"
                  >
                    <span className="inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/40">
                      <Thumb
                        item={item}
                        onUrlResigned={patchItemUrl}
                        onResignFailed={(label) =>
                          showToast(`预览失效：${label}`)
                        }
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-zinc-200">
                        {assetLabel(item)}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-zinc-600">
                        {item.mimeType || "—"}
                        {item.domains?.length
                          ? ` · ${item.domains.join("/")}`
                          : ""}
                        {item.createdAt
                          ? ` · ${formatShortDate(item.createdAt)}`
                          : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {nextCursor && !loading ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() =>
                void load({
                  domain,
                  kind,
                  cursor: nextCursor,
                  append: true,
                })
              }
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/6 py-2 text-[12px] text-zinc-400 hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  加载中…
                </>
              ) : (
                "加载更多"
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function formatShortDate(iso: string) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(t))
  } catch {
    return ""
  }
}
