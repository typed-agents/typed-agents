import { AgentRuntime } from "../agents/agent.runtime";
import { LLMClient } from "../clients/llm.client";
import type { RunOptions, PersistConfig } from "../agents/agent.types";

/**
 * P1 FIX: `globalRuntime` singleton eliminated.
 *
 * Before: a single shared runtime for all agents caused state collisions
 * when multiple runAgent calls ran in parallel.
 *
 * Now: each call creates its own isolated runtime, unless one is explicitly
 * passed (useful for sharing event listeners or cache between agents
 * coordinated by the same orchestrator).
 */

/**
 * Runs an agent class with the given prompt and options.
 *
 * Creates a new AgentRuntime instance if not provided, allowing for isolated
 * execution. Supports custom LLM clients, persistence, and runtime options.
 *
 * @param agentClass - The agent class decorated with `@agent()` to run.
 * @param prompt - The user input prompt to start the agent conversation.
 * @param showLogs - Whether to enable console logging (overridden by options.silent).
 * @param client - Optional LLM client to use instead of the agent's default.
 * @param options - Runtime options like maxSteps, temperature, persistence, etc.
 * @param runtime - Optional pre-configured AgentRuntime to use (for shared state).
 * @returns The final output string from the agent.
 */
export async function runAgent(
  agentClass: new () => object,
  prompt: string,
  showLogs = true,
  client?: LLMClient,
  options: RunOptions = {},
  runtime?: AgentRuntime,
): Promise<string> {
  const effectiveShowLogs = showLogs && !(options.silent ?? false);

  const persistCfg: PersistConfig =
    typeof options.persist === "boolean"
      ? options.persist
        ? { mode: "file", dir: "./.agent-runs" }
        : { mode: "none" }
      : (options.persist ?? { mode: "none" });

  const usedRuntime = runtime ?? new AgentRuntime(effectiveShowLogs, persistCfg);
  return usedRuntime.run(agentClass, prompt, client, options);
}