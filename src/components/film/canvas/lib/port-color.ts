import type { NodeKind } from "@/components/film/canvas/types/project";

/** Skill port family (skill / skill-r / skill-out) — matches Skill card blue book. */
export const SKILL_PORT_COLOR = "#60a5fa";

/** Asset target ports on Agent (in / in-r) — cyan, distinct from Skill blue. */
export const ASSET_IN_PORT_COLOR = "#22d3ee";

export const PORT_COLOR: Record<NodeKind, string> = {
  text: "#f0e6d0",
  image: "#8eb4d4",
  video: "#9b8ec4",
  audio: "#c49bd4",
  file: "#9a9386",
  script: "#e8c27a",
  storyboard: "#d4a574",
  scene: "#6ec8d4",
  character: "#e07aad",
  agent: "#e8c27a",
  skill: SKILL_PORT_COLOR,
};
