import { AgentBehavior } from "./behavior.types";

/**
 * Merges multiple AgentBehavior configurations into a single one.
 *
 * For most fields (role, answer, extends), later behaviors override earlier ones.
 * For "rules" and "planning", values are concatenated with newlines to accumulate.
 *
 * @param behaviors - Array of behaviors to merge, in order of precedence.
 * @returns A single merged AgentBehavior.
 */
export function mergeBehaviors(
  behaviors: AgentBehavior[]
): AgentBehavior {
  const result: AgentBehavior = {};

  for (const behavior of behaviors) {
    for (const key of Object.keys(behavior) as (keyof AgentBehavior)[]) {
      const value = behavior[key];
      if (!value) continue;

      if (key === "rules") {
        result.rules = [result.rules, value].filter(Boolean).join("\n");
      } else if (key === "planning") {
        result.planning = [result.planning, value].filter(Boolean).join("\n");
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}