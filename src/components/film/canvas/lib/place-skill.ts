import {
  type AgentSkillDetail,
  type AgentSkillListItem,
} from "@/lib/api/skills";
import { shortSkillTitle } from "@/components/film/canvas/lib/agent-catalog";
import { useProjectStore } from "@/components/film/canvas/store/project-store";

/** Put a published Skill onto the canvas as a skill card. */
export function placeSkillOnCanvas(
  item: AgentSkillListItem | AgentSkillDetail,
  options?: { position?: { x: number; y: number } }
) {
  const store = useProjectStore.getState();
  const skillId = item.id?.trim();
  if (!skillId) {
    store.showToast("Skill 缺少 id，无法放入画布");
    return null;
  }
  const title = (item.title || item.name || "Skill").trim();
  const preview =
    "body" in item && typeof item.body === "string"
      ? item.body.trim().slice(0, 240)
      : item.bodyPreview?.trim().slice(0, 240);
  const id = store.addNode("skill", {
    position: options?.position,
    data: {
      role: "skill",
      kind: "skill",
      label: title,
      skillId,
      skillName: item.name,
      skillTitle: title,
      skillVersion: item.version,
      skillAgent: item.agent,
      skillBodyPreview: preview || undefined,
      status: "success",
      text: preview || "",
    },
  });
  store.showToast(`已放入 Skill「${shortSkillTitle(title)}」`);
  return id;
}

/** Normalize listAgentSkills payloads (array or { items }). */
export function normalizeAgentSkillList(raw: unknown): AgentSkillListItem[] {
  if (Array.isArray(raw)) return raw as AgentSkillListItem[];
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { items?: AgentSkillListItem[] }).items)
  ) {
    return (raw as { items: AgentSkillListItem[] }).items ?? [];
  }
  return [];
}
