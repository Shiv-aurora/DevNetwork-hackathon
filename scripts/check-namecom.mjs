const environment = process.env.NAMECOM_ENV ?? "sandbox";
const username = process.env.NAMECOM_USERNAME;
const token = process.env.NAMECOM_TOKEN;

const endpoints = {
  sandbox: "https://api.dev.name.com",
  production: "https://api.name.com",
};

const baseUrl = endpoints[environment];

if (!baseUrl) {
  console.error(`Unsupported NAMECOM_ENV: ${environment}. Use sandbox or production.`);
  process.exit(1);
}

if (!username || !token) {
  console.error("NAMECOM_USERNAME and NAMECOM_TOKEN are required for the connectivity check.");
  process.exit(2);
}

if (environment === "sandbox" && !username.endsWith("-test")) {
  console.error("Sandbox authentication requires the name.com username with the -test suffix.");
  process.exit(3);
}

const auth = Buffer.from(`${username}:${token}`, "utf8").toString("base64");

try {
  const response = await fetch(`${baseUrl}/core/v1/hello`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(`name.com connectivity failed with HTTP ${response.status}.`);
    process.exit(4);
  }

  console.log(JSON.stringify({
    provider: "name.com",
    environment,
    baseUrl,
    credentials: "valid",
    publicDnsExpected: environment === "production",
  }, null, 2));
} catch (error) {
  console.error(`name.com connectivity failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(5);
}
