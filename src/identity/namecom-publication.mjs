function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} is required.`);
  return value.trim();
}

function safeToken(value) {
  return String(value).replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

export function buildIdentityDnsRecords({
  domainName,
  manifestTargetHost,
  rootFingerprint,
  manifestHost = "proof",
  manifestPublicUrl = null,
  agents,
}) {
  requireString(domainName, "domainName");
  requireString(manifestTargetHost, "manifestTargetHost");
  requireString(rootFingerprint, "rootFingerprint");
  if (!Array.isArray(agents) || agents.length === 0) throw new Error("agents must be a non-empty array.");

  const manifestUrl = manifestPublicUrl
    ? requireString(manifestPublicUrl, "manifestPublicUrl")
    : `https://${manifestHost}.${domainName}/.well-known/proofroot.json`;
  if (!/^https:\/\//i.test(manifestUrl)) throw new Error("manifestPublicUrl must use HTTPS.");

  const records = [
    Object.freeze({
      purpose: "organization-root",
      type: "TXT",
      host: "_proofroot",
      answer: `v=proofroot1;manifest=${manifestUrl};fp=${safeToken(rootFingerprint)};status=active`,
      ttl: 300,
    }),
    Object.freeze({
      purpose: "manifest-host",
      type: "CNAME",
      host: manifestHost,
      answer: manifestTargetHost,
      ttl: 300,
    }),
    ...agents.map((agent) => Object.freeze({
      purpose: "agent-locator",
      agentId: agent.id,
      type: "TXT",
      host: `_agent.${safeToken(agent.id)}`,
      answer: `v=proofroot1;id=${safeToken(agent.id)};kid=${safeToken(agent.keyId)};fp=${safeToken(agent.fingerprint)};status=${safeToken(agent.status ?? "active")}`,
      ttl: 300,
    })),
  ];

  return Object.freeze({
    domainName,
    manifestUrl,
    rootFingerprint,
    records: Object.freeze(records),
  });
}

export async function publishIdentityDnsRecords({ client, plan }) {
  if (!client || typeof client.createRecord !== "function") throw new Error("A name.com client is required.");
  if (!plan?.domainName || !Array.isArray(plan?.records)) throw new Error("A publication plan is required.");

  const created = [];
  for (const record of plan.records) {
    const providerRecord = await client.createRecord(plan.domainName, record);
    created.push(Object.freeze({
      purpose: record.purpose,
      agentId: record.agentId ?? null,
      providerRecordId: providerRecord?.id ?? null,
      type: providerRecord?.type ?? record.type,
      host: providerRecord?.host ?? record.host,
      answer: providerRecord?.answer ?? record.answer,
      ttl: providerRecord?.ttl ?? record.ttl,
    }));
  }

  return Object.freeze({
    provider: "name.com",
    domainName: plan.domainName,
    manifestUrl: plan.manifestUrl,
    createdRecords: Object.freeze(created),
  });
}

export async function reconcileIdentityDnsRecords({ client, plan }) {
  if (!client || typeof client.listRecords !== "function") throw new Error("A name.com client is required.");
  const providerState = await client.listRecords(plan.domainName);
  const records = Array.isArray(providerState?.records) ? providerState.records : [];

  const matches = plan.records.map((expected) => {
    const found = records.find((record) => record.type === expected.type
      && record.host === expected.host
      && record.answer === expected.answer);
    return Object.freeze({
      purpose: expected.purpose,
      expected,
      matched: Boolean(found),
      providerRecordId: found?.id ?? null,
    });
  });

  return Object.freeze({
    domainName: plan.domainName,
    matched: matches.every((entry) => entry.matched),
    records: Object.freeze(matches),
  });
}
