import { ReplayStore } from "../gateway/proof-gateway.mjs";

const REPLAY_STORE_SYMBOL = Symbol.for("proofroot.serverReplayStore");

export function getServerReplayStore() {
  if (!globalThis[REPLAY_STORE_SYMBOL]) {
    globalThis[REPLAY_STORE_SYMBOL] = new ReplayStore();
  }
  return globalThis[REPLAY_STORE_SYMBOL];
}

export function resetServerReplayStore() {
  const store = getServerReplayStore();
  store.reset();
  return store;
}
