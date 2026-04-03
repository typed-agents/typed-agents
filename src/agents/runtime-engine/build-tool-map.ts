import { ToolRegistry } from "../../tools/registry";
import { convertZodToToolSchema } from "./convert-zod-to-tool-schema";
import type { ToolDefinition } from "../../tools/tool.types";
import { ToolMapEntry } from "../../tools/tool.types";
import type { ToolDependency } from "../agent.types";
import { isComposableTool } from "../agent.types";
import { getAgentMetadata } from "../agent.decorator";
import { z } from "zod";

/**
 * Builds the tool dispatch map and LLM tool definitions from agent tool dependencies.
 *
 * Processes each ToolDependency: for "auto", fetches all registered tools; for classes/instances,
 * extracts registered methods; for composable tools, creates synthetic tool entries.
 * Populates the toolMap for runtime dispatch and llmTools for LLM API calls.
 *
 * @param tools - Array of tool dependencies from agent options.
 * @param toolMap - Map to populate with tool name -> ToolMapEntry for execution.
 * @param llmTools - Array to populate with ToolDefinition objects for LLM.
 */
export const buildToolMap = (
  tools: ToolDependency[],
  toolMap: Map<string, ToolMapEntry>,
  llmTools: ToolDefinition[]
) => {
  const processedTools = tools.flatMap((t) =>
    t === "auto" ? ToolRegistry.getAllRegisteredClasses() : [t]
  );

  for (const t of processedTools) {
    if (!isComposableTool(t)) {
      const isInstance = typeof t === "object";
      const instance = isInstance ? t : new (t as any)();
      const cls = isInstance ? t.constructor : (t as any);

      const registryTools = ToolRegistry.getTools(cls);

      for (const rt of registryTools) {
        if (toolMap.has(rt.metadata.name)) continue;

        toolMap.set(rt.metadata.name, {
          instance,
          method: rt.method,
          metadata: rt.metadata,
        });

        llmTools.push({
          type: "function",
          function: {
            name: rt.metadata.name,
            description: rt.metadata.description,
            parameters: rt.metadata.inputSchema
              ? convertZodToToolSchema(rt.metadata.inputSchema)
              : { type: "object", properties: {} },
          },
        });
      }
      continue;
    }

    const comp = t;
    const agentMeta = getAgentMetadata(comp.AgentClass);
    if (!agentMeta) continue;

    const toolName = comp.name ?? agentMeta.name;
    if (toolMap.has(toolName)) continue;

    const inputKey = comp.inputKey;

    const inputSchema = z.object({
      [inputKey]: z.string().describe("Task/prompt for the sub-agent"),
    });

    toolMap.set(toolName, {
      instance: null,
      method: "__run_composable__",
      metadata: {
        name: toolName,
        description:
          comp.description ??
          `Delegates task to specialized agent "${toolName}"`,
        inputSchema,
        isComposable: true,
        agentClass: comp.AgentClass,
        maxSteps: comp.maxSteps,
      },
    });

    llmTools.push({
      type: "function",
      function: {
        name: toolName,
        description: comp.description ?? `Call the ${toolName} agent`,
        parameters: {
          type: "object",
          properties: { [inputKey]: { type: "string" } },
          required: [inputKey],
        },
      },
    });
  }
};