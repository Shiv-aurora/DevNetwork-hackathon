import { ModelRuntimeError, verifyGroqConnectivity } from "../src/agents/model-runtime.mjs";

try {
  const result = await verifyGroqConnectivity({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (error instanceof ModelRuntimeError) {
    console.error(`Groq verification failed: ${error.message}`);
    process.exitCode = error.code === "MISSING_CONFIGURATION" ? 2 : 1;
  } else {
    console.error("Groq verification failed: unexpected internal error.");
    process.exitCode = 1;
  }
}
