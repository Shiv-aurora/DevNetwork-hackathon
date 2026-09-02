"use client";

import { useState } from "react";

export default function ResetDemoButton() {
  const [state, setState] = useState("idle");

  async function reset() {
    setState("resetting");
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      if (!response.ok) throw new Error("reset failed");
      setState("done");
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("failed");
    }
  }

  const labels = {
    idle: "Reset demo fixture",
    resetting: "Resetting…",
    done: "Fixture reset",
    failed: "Reset failed",
  };

  return <button className="reset-button" type="button" onClick={reset} disabled={state === "resetting"}>{labels[state]}</button>;
}
