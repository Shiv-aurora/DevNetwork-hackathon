import { NextResponse } from "next/server";
import { createGoldenFixture } from "../../../../src/core/golden-fixture.mjs";
import { resetServerReplayStore } from "../../../../src/server/replay-runtime.mjs";

export const runtime = "nodejs";

export async function POST() {
  resetServerReplayStore();
  return NextResponse.json({
    reset: true,
    replayState: "cleared-for-current-process-runtime",
    fixture: createGoldenFixture(),
  });
}
