import assert from "node:assert/strict"
import test from "node:test"
import type { AppNode } from "../components/film/canvas/types/project.ts"
import {
  characterHasThreeViews,
  makeupLockedReason,
  storyboardThreeViewGate,
} from "./film-makeup-gate.ts"

function card(id: string, extra: Partial<AppNode["data"]> = {}): AppNode {
  return {
    id,
    type: "text",
    position: { x: 0, y: 0 },
    data: {
      role: "asset",
      kind: "text",
      label: id,
      status: "success",
      prompt: "",
      model: "",
      aspect: "16:9",
      duration: "",
      text: "角色",
      assetRole: "character",
      textAssetCard: true,
      ...extra,
    },
  }
}

test("storyboard gate requires three views on character cards", () => {
  const empty = storyboardThreeViewGate([])
  assert.equal(empty.ok, false)
  const partial = storyboardThreeViewGate([
    card("c1", { threeViews: { front: { url: "https://x/f" } } }),
  ])
  assert.equal(partial.ok, false)
  const full = storyboardThreeViewGate([
    card("c1", {
      threeViews: {
        front: { url: "https://x/f" },
        side: { s3Key: "k" },
        back: { assetId: "a" },
      },
    }),
  ])
  assert.equal(full.ok, true)
  assert.equal(characterHasThreeViews(full.ok ? card("c1", {
    threeViews: {
      front: { url: "https://x/f" },
      side: { s3Key: "k" },
      back: { assetId: "a" },
    },
  }) : card("x")), true)
})

test("makeup locks after storyboard out", () => {
  const board: AppNode = {
    id: "sb",
    type: "storyboard",
    position: { x: 0, y: 0 },
    data: {
      role: "asset",
      kind: "storyboard",
      label: "分镜",
      status: "success",
      prompt: "",
      model: "",
      aspect: "16:9",
      duration: "",
      text: "",
      scriptRows: [
        {
          id: "r",
          shotId: "S01",
          duration: "1s",
          visualDesc: "a",
          dialogue: "",
          selected: true,
          rowStatus: "success",
        },
      ],
    },
  }
  assert.equal(makeupLockedReason(false, [board]), "分镜已出，定妆已锁定")
  assert.equal(makeupLockedReason(false, []), null)
})
