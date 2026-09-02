import { createHash } from "node:crypto";

function normalize(value, path = "$" ) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}.`);
    return value;
  }

  if (Array.isArray(value)) return value.map((item, index) => normalize(item, `${path}[${index}]`));

  if (typeof value === "object") {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child === undefined) throw new TypeError(`Undefined value at ${path}.${key}.`);
      normalized[key] = normalize(child, `${path}.${key}`);
    }
    return normalized;
  }

  throw new TypeError(`Unsupported canonical JSON value at ${path}.`);
}

export function canonicalize(value) {
  return JSON.stringify(normalize(value));
}

export function canonicalDigest(value) {
  return `sha256:${createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}`;
}
