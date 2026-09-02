import { checkNamecomEnvironment, NamecomCheckError } from "../src/integrations/namecom-check.mjs";

try {
  const result = await checkNamecomEnvironment({
    environment: process.env.NAMECOM_ENV,
    username: process.env.NAMECOM_USERNAME,
    token: process.env.NAMECOM_TOKEN,
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (error instanceof NamecomCheckError) {
    console.error(`name.com verification failed: ${error.message}`);
    process.exitCode = error.exitCode;
  } else {
    console.error("name.com verification failed: unexpected internal error.");
    process.exitCode = 1;
  }
}
