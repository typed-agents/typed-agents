/**
 * Safely coerces tool arguments into a plain Record<string, unknown>.
 *
 * Handles all shapes the LLM may produce:
 * - already a plain object  → returned as-is
 * - JSON string             → parsed
 * - non-JSON string         → wrapped as { input: "<value>" }
 * - scalar (number/boolean) → wrapped as { input: <value> }
 * - array / null / undefined → empty object {}
 */
export function parseToolArguments(args: unknown): Record<string, unknown> {
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }

  if (typeof args === "string") {
    const trimmed = args.trim();
    if (trimmed === "" || trimmed === "{}") return {};

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
      // JSON parsed to a scalar or array — wrap it
      return { input: parsed };
    } catch {
      // Raw string, not JSON — treat as single-input payload
      return { input: trimmed };
    }
  }

  if (typeof args === "number" || typeof args === "boolean") {
    return { input: args };
  }

  return {};
}