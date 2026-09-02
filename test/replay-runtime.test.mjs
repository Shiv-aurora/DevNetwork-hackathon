import test from "node:test";
import assert from "node:assert/strict";

import { getServerReplayStore, resetServerReplayStore } from "../src/server/replay-runtime.mjs";

test("server replay store is reused within the process runtime", () => {
  resetServerReplayStore();
  const first = getServerReplayStore();
  const second = getServerReplayStore();
  assert.equal(first, second);
  assert.equal(first.consume("nonce-demo"), true);
  assert.equal(second.consume("nonce-demo"), false);
});

test("demo reset clears process-runtime replay state", () => {
  const store = getServerReplayStore();
  assert.equal(store.has("nonce-demo"), true);
  const reset = resetServerReplayStore();
  assert.equal(reset, store);
  assert.equal(store.has("nonce-demo"), false);
  assert.equal(store.consume("nonce-demo"), true);
  resetServerReplayStore();
});
