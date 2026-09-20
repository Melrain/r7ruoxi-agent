export type FilmWriteFeature = "write-script" | "write-storyboard" | "run-next"

export function missingFilmEndpointMessage(feature: FilmWriteFeature): string {
  if (feature === "write-script") return "后端尚未提供写剧本接口，无法假装成功"
  if (feature === "write-storyboard") return "后端尚未提供写分镜接口，无法假装成功"
  return "后端尚未提供下一步接口，无法假装成功"
}
