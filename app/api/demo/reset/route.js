import { NextResponse } from "next/server";
import { createGoldenFixture } from "../../../../src/core/golden-fixture.mjs";

export async function POST() {
  return NextResponse.json({
    reset: true,
    fixture: createGoldenFixture(),
  });
}
