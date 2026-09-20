import assert from "node:assert/strict"
import test from "node:test"
import { filterFilmOnlyAssets, isFilmOnlyAsset } from "./film-domain.ts"

test("filmOnly drops makeup and recruit domains", () => {
  assert.equal(isFilmOnlyAsset({ domains: ["film"] }), true)
  assert.equal(isFilmOnlyAsset({ domains: ["film", "makeup"] }), false)
  assert.equal(isFilmOnlyAsset({ domains: ["recruit"] }), false)
  assert.equal(isFilmOnlyAsset({ domains: [], filmReferenceId: "r1" }), true)
  assert.equal(isFilmOnlyAsset({ domains: [] }), false)
  const kept = filterFilmOnlyAssets([
    { domains: ["film"], filmReferenceId: undefined, filmProjectId: undefined },
    { domains: ["makeup"], filmReferenceId: undefined, filmProjectId: undefined },
  ])
  assert.equal(kept.length, 1)
})
