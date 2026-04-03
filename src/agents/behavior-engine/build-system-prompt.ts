import { AgentBehavior } from "./behavior.types";

/**
 * Builds a formatted system prompt string from an AgentBehavior configuration.
 *
 * Concatenates each defined behavior section (role, rules, planning, answer)
 * into a structured prompt with section headers. Sections are joined with double newlines.
 *
 * @param behavior - The behavior configuration to build the prompt from.
 * @returns A formatted system prompt string.
 */
export function buildSystemPrompt(behavior: AgentBehavior): string {
  const parts: string[] = [];

  if (behavior.role) {
    parts.push(`## ROLE\n${behavior.role}`);
  }

  if (behavior.rules) {
    parts.push(`## RULES\n${behavior.rules}`);
  }

  if (behavior.planning) {
    parts.push(`## PLANNING\n${behavior.planning}`);
  }

  if (behavior.answer) {
    parts.push(`## ANSWER STYLE\n${behavior.answer}`);
  }

  return parts.join("\n\n");
}
