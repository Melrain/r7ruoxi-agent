import type { LibraryAsset } from "@/lib/api/assets"

/** filmOnly：remix / 历史选用不得混入妆造、招聘列表。 */
export function isFilmOnlyAsset(item: Pick<LibraryAsset, "domains" | "filmReferenceId" | "filmProjectId">): boolean {
  const domains = Array.isArray(item.domains) ? item.domains : []
  if (domains.includes("recruit") || domains.includes("makeup")) return false
  if (domains.includes("film")) return true
  return Boolean(item.filmReferenceId?.trim() || item.filmProjectId?.trim())
}

export function filterFilmOnlyAssets<T extends Pick<LibraryAsset, "domains" | "filmReferenceId" | "filmProjectId">>(
  items: T[],
): T[] {
  return items.filter(isFilmOnlyAsset)
}

export function filmOnlyListHint() {
  return "只列影片域素材，不会混入妆造/招聘"
}
