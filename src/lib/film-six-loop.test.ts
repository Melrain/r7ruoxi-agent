import assert from "node:assert/strict"
import test from "node:test"
import { missingDirectorSkeletonAgents, nextFilmSixLoop } from "./film-six-loop.ts"

function agent(id: string, agentId: string) {
  return {
    id,
    type: "agent",
    position: { x: 0, y: 0 },
    data: {
      role: "agent",
      kind: "agent",
      agentId,
      label: agentId,
      status: "idle",
      prompt: "",
      model: "",
      aspect: "16:9",
      duration: "",
      text: "",
    },
  }
}

function asset(
  id: string,
  kind: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: {
      role: "asset",
      kind,
      label: id,
      status: extra.status ?? "success",
      prompt: "",
      model: "",
      aspect: "16:9",
      duration: "",
      text: extra.text ?? "",
      ...extra,
    },
  }
}

function edge(source: string, target: string, edgeKind: "in" | "out") {
  return {
    id: `e_${source}_${target}`,
    source,
    target,
    data: { edgeKind },
  }
}

test("next loop starts at parse on empty canvas", () => {
  assert.equal(nextFilmSixLoop([], []), "parse")
})

test("next loop advances after parse + script + assets", () => {
  const nodes = [
    agent("a1", "parse"),
    asset("b1", "text", { text: "拆解", scriptRows: [{ id: "r", shotId: "S01", duration: "1s", visualDesc: "a", dialogue: "", selected: true, rowStatus: "success" }] }),
    agent("a2", "script"),
    asset("s1", "script", { text: "《戏》" }),
    asset("c1", "text", { textAssetCard: true, assetRole: "character", text: "男主" }),
  ]
  const edges = [
    edge("a1", "b1", "out"),
    edge("a2", "s1", "out"),
  ]
  assert.equal(nextFilmSixLoop(nodes, edges), "storyboard")
})

test("director skeleton reports missing agents", () => {
  assert.deepEqual(missingDirectorSkeletonAgents([agent("a1", "parse")]), [
    "script",
    "storyboard",
    "image",
    "video",
  ])
})
