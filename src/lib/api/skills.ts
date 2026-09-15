import { backendFetch } from "@/lib/api/client"

export type AgentSkillSource = "official" | "user"
export type AgentSkillStatus = "draft" | "published"

export type AgentSkillListItem = {
  id: string
  name: string
  title: string
  agent: string
  version: string
  lang: string
  s3Key?: string | null
  maxChars: number
  source: AgentSkillSource
  license?: string | null
  status: AgentSkillStatus
  createdAt: string
  updatedAt: string
  bodyPreview?: string
}

export type AgentSkillDetail = AgentSkillListItem & {
  body: string
}

export async function listAgentSkills(options?: {
  agent?: string
  status?: AgentSkillStatus
  signal?: AbortSignal
}) {
  const q = new URLSearchParams()
  if (options?.agent) q.set("agent", options.agent)
  if (options?.status) q.set("status", options.status)
  const qs = q.toString()
  return backendFetch<AgentSkillListItem[]>(
    `/api/backend/internal/skills${qs ? `?${qs}` : ""}`,
    { signal: options?.signal, timeoutMs: 30_000 },
  )
}

export async function getAgentSkill(
  id: string,
  options?: { signal?: AbortSignal },
) {
  return backendFetch<AgentSkillDetail>(
    `/api/backend/internal/skills/${encodeURIComponent(id)}`,
    { signal: options?.signal, timeoutMs: 30_000 },
  )
}

export async function getAgentSkillByName(
  name: string,
  options?: {
    version?: string
    status?: AgentSkillStatus
    signal?: AbortSignal
  },
) {
  const q = new URLSearchParams()
  if (options?.version) q.set("version", options.version)
  if (options?.status) q.set("status", options.status)
  const qs = q.toString()
  return backendFetch<AgentSkillDetail>(
    `/api/backend/internal/skills/by-name/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`,
    { signal: options?.signal, timeoutMs: 30_000 },
  )
}
