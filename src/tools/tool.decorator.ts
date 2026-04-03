import "reflect-metadata";
import { ToolMetadata, ToolClass } from "./tool.types";
import { ToolRegistry } from "./registry";

/**
 * Reflect metadata key used to store {@link ToolMetadata} on a decorated method.
 *
 * Scoped with a namespaced string (`typed-agents:tool`) to avoid collisions with
 * other libraries that also use `reflect-metadata`. Kept as a module-level constant
 * so it can be referenced both when writing and when reading the metadata.
 *
 * @internal
 */
const TOOL_METADATA_KEY = Symbol("typed-agents:tool");

/**
 * Method decorator that marks a class method as an AI-invokable tool.
 *
 * Applying `@tool()` to a method does two things at class-definition time:
 * 1. **Stores metadata** on the method via `Reflect.defineMetadata`, making it
 *    available for later introspection with `Reflect.getMetadata`.
 * 2. **Registers the method** in the global {@link ToolRegistry}, so the framework
 *    can discover and dispatch it without any additional wiring.
 *
 * The decorator is designed to be the *only* configuration point you need:
 * after decorating a method, its class can be passed directly to an agent and
 * all tools will be available automatically.
 *
 * ### Requirements
 * - `experimentalDecorators: true` and `emitDecoratorMetadata: true` must be
 *   enabled in `tsconfig.json`.
 * - `reflect-metadata` must be imported once at the application entry point
 *   (or is handled by this module's top-level import).
 *
 * ### Warnings
 * - If `metadata.description` is absent, the decorator applies a default description
 *   ("No description provided"), which may hurt LLM tool-selection quality. It is
 *   strongly recommended to always provide a meaningful description.
 * - Registering two tools with the same `metadata.name` (across any class) may lead
 *   to non-deterministic model behaviour. Ensure tool names are unique globally.
 *
 * @param metadata - Configuration object describing the tool to the framework and
 *                   to the language model. At minimum, `name` and `description`
 *                   should always be provided.
 *
 * @returns A standard TypeScript method decorator function.
 *
 * @example — Basic tool
 * 
 * import { z } from 'zod';
 * import { tool } from './tool.decorator';
 *
 * class WebTools {
 *   @tool({
 *     name: 'search_web',
 *     description: 'Searches the web and returns the top results for a query.',
 *     inputSchema: z.object({ query: z.string().describe('The search query') }),
 *     outputSchema: z.array(z.string()),
 *   })
 *   async searchWeb(input: { query: string }): Promise<string[]> {
 *     // implementation
 *   }
 * }
 * 
 *
 * @example — Composable tool (delegates to a sub-agent)
 * 
 * class OrchestratorTools {
 *   @tool({
 *     name: 'run_research_agent',
 *     description: 'Runs a specialised research agent for in-depth information gathering.',
 *     inputSchema: z.object({ topic: z.string() }),
 *     isComposable: true,
 *     agentClass: ResearchAgent,
 *     maxSteps: 15,
 *   })
 *   async runResearch(input: { topic: string }) {
 *     // The framework handles delegation — this body may be empty.
 *   }
 * }
 * 
 */
export function tool(metadata: ToolMetadata) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    /**
     * Resolved metadata with guaranteed defaults applied.
     * `description` falls back to a placeholder so downstream consumers
     * (e.g. tool-definition serialisers) never receive `undefined`.
     */
    const finalMetadata: ToolMetadata = {
      ...metadata,
      description: metadata.description ?? "No description provided",
    };

    Reflect.defineMetadata(
      TOOL_METADATA_KEY,
      finalMetadata,
      target,
      propertyKey
    );

    ToolRegistry.registerMethod(
      target.constructor as ToolClass,
      propertyKey,
      finalMetadata
    );
  };
}