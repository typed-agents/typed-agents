import { ToolMapEntry } from "../../tools/tool.types";
import { parseToolArguments } from "./parse-tool-arguments";
import { runAgent } from "../../runtime/agent.runner";
import type { RunOptions, ToolResult } from "../agent.types";
import { toolSuccess, toolFailure } from "../agent.types";
import crypto from "crypto";

/**
 * Executes a tool by name using the provided arguments and tool map.
 *
 * Handles both regular tool methods (calling instance methods) and composable sub-agents
 * (running dedicated agent classes). Performs argument parsing, input validation,
 * caching for sub-agents, and output validation. Returns a structured ToolResult
 * indicating success or failure.
 *
 * @param name - The tool name to execute.
 * @param rawArgs - Raw arguments from the LLM tool call.
 * @param toolMap - Map of tool names to ToolMapEntry for dispatch.
 * @param subAgentOptions - Options for sub-agent execution (maxSteps, etc.).
 * @param subAgentCache - Cache map for sub-agent results to avoid re-execution.
 * @returns A ToolResult with success value or error details.
 */
export const executeTool = async (
  name: string,
  rawArgs: unknown,
  toolMap: Map<string, ToolMapEntry>,
  subAgentOptions: RunOptions = {},
  subAgentCache: Map<string, string> = new Map()
): Promise<ToolResult> => {
  const entry = toolMap.get(name);
  if (!entry) {
    return toolFailure(name, `Tool "${name}" not found in tool map.`);
  }

  const { instance, method, metadata } = entry;

  // P2: parsing errors are now surfaced, not silently swallowed
  let parsedInput: Record<string, unknown>;
  try {
    parsedInput = parseToolArguments(rawArgs);
  } catch (err) {
    return toolFailure(name, `Argument parsing failed: ${String(err)}`);
  }

  // Input validation via Zod schema
  if (metadata.inputSchema) {
    const validation = metadata.inputSchema.safeParse(parsedInput);
    if (!validation.success) {
      return toolFailure(
        name,
        `Input validation failed: ${validation.error.message}`
      );
    }
    parsedInput = validation.data as Record<string, unknown>;
  }

  // ── Composable sub-agent execution ──────────────────────────────────────
  if (metadata.isComposable && metadata.agentClass) {
    const inputKey =
      Object.keys((metadata.inputSchema as any)?.shape ?? {})[0] ?? "task";

    const task =
      (parsedInput as any)?.[inputKey] ??
      (typeof parsedInput === "string"
        ? parsedInput
        : JSON.stringify(parsedInput));

    const cacheKey = crypto
      .createHash("sha256")
      .update(name + JSON.stringify(task))
      .digest("hex");

    if (subAgentCache.has(cacheKey)) {
      return toolSuccess(subAgentCache.get(cacheKey)!);
    }

    try {
      const result = await runAgent(
        metadata.agentClass,
        task,
        false,
        undefined,
        {
          maxSteps:    metadata.maxSteps ?? subAgentOptions.maxSteps ?? 1,
          temperature: subAgentOptions.temperature ?? 0,
          maxRetries:  subAgentOptions.maxRetries ?? 3,
          retryDelayMs: subAgentOptions.retryDelayMs ?? 800,
          backoff:     subAgentOptions.backoff ?? true,
          persist:     subAgentOptions.persist ?? { mode: "none" },
        }
      );
      subAgentCache.set(cacheKey, result);
      return toolSuccess(result);
    } catch (err) {
      return toolFailure(name, `Sub-agent execution failed: ${String(err)}`);
    }
  }

  // ── Regular tool method execution ────────────────────────────────────────
  if (!instance) {
    return toolFailure(name, `Tool instance is null for "${name}".`);
  }

  try {
    const fn = (instance as Record<string, unknown>)[method] as (
      args: Record<string, unknown>
    ) => Promise<unknown> | unknown;

    const output = await fn.call(instance, parsedInput);

    // Optional output validation — soft warn, do not fail
    if (metadata.outputSchema) {
      const outValidation = metadata.outputSchema.safeParse(output);
      if (!outValidation.success) {
        console.warn(
          `[Tool:${name}] Output schema mismatch: ${outValidation.error.message}`
        );
      }
    }

    const stringOutput =
      typeof output === "string" ? output : JSON.stringify(output);
    return toolSuccess(stringOutput);
  } catch (err) {
    return toolFailure(name, String(err));
  }
};