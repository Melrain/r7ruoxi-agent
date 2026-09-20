import assert from "node:assert/strict"
import test from "node:test"
import { createFilmRunToken, stillMine } from "./film-race.ts"

test("stillMine rejects aborted or swapped run/project", () => {
  const token = createFilmRunToken("p1", "n1")
  assert.equal(stillMine(token, { projectId: "p1", runId: token.runId }), true)
  assert.equal(stillMine(token, { projectId: "p1", runId: token.runId, aborted: true }), false)
  assert.equal(stillMine(token, { projectId: "p2", runId: token.runId }), false)
  assert.equal(stillMine(token, { projectId: "p1", runId: "other" }), false)
})
