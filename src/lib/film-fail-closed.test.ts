import assert from "node:assert/strict"
import test from "node:test"
import { missingFilmEndpointMessage } from "./film-fail-closed.ts"

test("missing endpoints speak honest fail-closed copy", () => {
  assert.match(missingFilmEndpointMessage("write-script"), /无法假装成功/)
  assert.match(missingFilmEndpointMessage("write-storyboard"), /无法假装成功/)
  assert.match(missingFilmEndpointMessage("run-next"), /无法假装成功/)
})
