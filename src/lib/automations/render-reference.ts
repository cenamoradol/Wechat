// src/lib/automations/render-reference.ts
// ponytail: reference vocabulary renderer for the `ai_extract` step's
// `referencePath`. Pretty-prints any value the prior step left in vars
// (typically a webhook JSON response) into a compact, prompt-safe text
// block the LLM can scan while matching customer text. Truncates at
// 8 KB to keep the prompt budget honest.

const MAX_REFERENCE_CHARS = 8 * 1024;
const TRUNCATION_MARKER = "\n... [truncated]";

export function renderReference(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return truncate(raw);
  if (typeof raw === "number" || typeof raw === "boolean") return truncate(String(raw));
  try {
    return truncate(JSON.stringify(raw, null, 2));
  } catch {
    return truncate(String(raw));
  }
}

function truncate(s: string): string {
  if (s.length <= MAX_REFERENCE_CHARS) return s;
  return s.slice(0, MAX_REFERENCE_CHARS) + TRUNCATION_MARKER;
}

/**
 * Resolve a `referencePath` expression against a vars root. Mirrors the
 * same path syntax `interpolate()` accepts (`vars.x.y[0]`). Returns the
 * raw value at that path, or `undefined` if the path doesn't resolve.
 */
export function resolveReferencePath(vars: unknown, rawPath: string): unknown {
  const path = rawPath.trim();
  if (!path) return undefined;
  const stripped =
    path.startsWith("vars.") || path === "vars"
      ? path.replace(/^vars\.?/, "")
      : path;
  if (!stripped) return undefined;
  const parts: Array<string | number> = [];
  for (const segment of stripped.split(".")) {
    const m = segment.match(/^([\w]+)((?:\[\d+\])+)$/);
    if (m) {
      parts.push(m[1]);
      for (const idx of segment.matchAll(/\[(\d+)\]/g)) {
        parts.push(Number(idx[1]));
      }
    } else {
      parts.push(segment);
    }
  }
  return resolvePath(vars, parts);
}

function resolvePath(root: unknown, parts: Array<string | number>): unknown {
  let value: unknown = root;
  for (const part of parts) {
    if (value == null) return undefined;
    if (typeof part === "number") {
      if (!Array.isArray(value)) return undefined;
      value = value[part];
    } else {
      if (typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[part];
    }
  }
  return value;
}
