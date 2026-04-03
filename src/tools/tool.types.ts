import { ZodType } from "zod";

/**
 * Metadata that describes a tool registered within the typed-agents framework.
 *
 * A tool is a discrete unit of functionality that an AI agent can invoke during
 * its reasoning loop. Each tool is associated with a class method decorated with
 * `@tool()` and is automatically registered in the {@link ToolRegistry}.
 *
 * @example
 * 
 * @tool({
 *   name: 'search_web',
 *   description: 'Searches the web and returns a list of relevant results.',
 *   inputSchema: z.object({ query: z.string() }),
 *   outputSchema: z.array(z.string()),
 * })
 * async searchWeb(input: { query: string }): Promise<string[]> { ... }
 * 
 */
export interface ToolMetadata {
  /**
   * The unique identifier of the tool as exposed to the AI model.
   *
   * This name is sent directly to the language model and must be unique across
   * all registered tools in the agent session. Use `snake_case` to maximize
   * compatibility with all LLM providers.
   *
   * @example 'search_web', 'read_file', 'send_email'
   */
  name: string;

  /**
   * A human-readable description of what the tool does.
   *
   * This string is passed verbatim to the language model and directly influences
   * how and when the model decides to invoke the tool. A clear, specific description
   * improves tool selection accuracy. Treat it as a prompt.
   *
   * @example 'Searches the web using a query string and returns the top 5 results as URLs.'
   */
  description: string;

  /**
   * A Zod schema describing the expected shape of the tool's input.
   *
   * When provided, the framework will:
   * 1. Serialize this schema into a JSON Schema and send it to the model as the
   *    tool's `parameters` definition, guiding the model to produce valid calls.
   * 2. Validate the model's arguments at runtime before invoking the method,
   *    throwing a descriptive error if the input does not conform.
   *
   * If omitted, the tool accepts no input parameters.
   *
   * @example
   * 
   * inputSchema: z.object({
   *   query: z.string().describe('The search query'),
   *   maxResults: z.number().int().optional().default(5),
   * })
   * 
   */
  inputSchema?: ZodType;

  /**
   * A Zod schema describing the expected shape of the tool's return value.
   *
   * When provided, the framework validates the method's return value after execution.
   * Useful for catching implementation bugs early and for generating typed output
   * contracts that downstream tools or agents can rely on.
   *
   * If omitted, no runtime validation is performed on the output.
   */
  outputSchema?: ZodType;

  /**
   * A natural-language description of what the tool returns.
   *
   * Complements `outputSchema` by providing a prose explanation of the output
   * for documentation and potential model consumption (e.g., in chain-of-thought
   * prompts). Does not affect runtime validation.
   *
   * @example 'A list of URLs matching the search query, ordered by relevance.'
   */
  outputDescription?: string;

  /**
   * Whether this tool can be composed as a sub-agent step within a parent agent.
   *
   * When `true`, the tool is treated as a composable unit that delegates execution
   * to a dedicated agent class (specified via `agentClass`). This enables building
   * hierarchical multi-agent pipelines where a parent agent orchestrates specialized
   * child agents as if they were ordinary tools.
   *
   * Requires `agentClass` to be set.
   *
   * @default false
   */
  isComposable?: boolean;

  /**
   * The agent class to instantiate and run when this tool is invoked in composable mode.
   *
   * Only meaningful when `isComposable` is `true`. The provided class will be
   * instantiated fresh on each invocation, ensuring isolated state per tool call.
   *
   * @example
   * 
   * isComposable: true,
   * agentClass: ResearchAgent,
   * 
   */
  agentClass?: new () => object;

  /**
   * Maximum number of reasoning/action steps the tool's agent is allowed to take.
   *
   * Acts as a safety cap to prevent infinite loops in agentic execution. Once the
   * limit is reached the agent is forced to return its current best answer.
   * Only relevant when `isComposable` is `true`.
   *
   * @default Framework-level default (typically 10)
   */
  maxSteps?: number;
}

/**
 * Represents any class whose constructor accepts no arguments and returns an object.
 *
 * Used as the key type in {@link ToolRegistry} to map tool classes to their
 * registered methods. Any class decorated with `@tool()` on one or more of its
 * methods qualifies as a `ToolClass`.
 *
 * @example
 * 
 * class MyTools { ... }          // qualifies as ToolClass
 * const cls: ToolClass = MyTools;
 * const instance = new cls();
 * 
 */
export type ToolClass = new () => object;

/**
 * The wire-format definition of a tool as sent to an LLM API (e.g. OpenAI / Anthropic).
 *
 * This structure follows the OpenAI function-calling schema and is produced by the
 * framework when serializing registered tools before each model call. You will
 * rarely need to construct this manually — it is generated from {@link ToolMetadata}.
 *
 * @see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tools
 */
export interface ToolDefinition {
  /** Always `"function"` for LLM tool definitions. */
  type: "function";

  function: {
    /** The unique tool name as seen by the model. Matches {@link ToolMetadata.name}. */
    name: string;

    /** The tool description forwarded to the model. Matches {@link ToolMetadata.description}. */
    description: string;

    /** JSON Schema description of the tool's input parameters, derived from {@link ToolMetadata.inputSchema}. */
    parameters: ToolParameterSchema;
  };
}

/**
 * A JSON Schema–compatible description of the parameters accepted by a tool.
 *
 * This is embedded inside {@link ToolDefinition} and is automatically generated
 * from the tool's `inputSchema` Zod definition. It tells the LLM which fields
 * to populate when invoking the tool and which of them are required.
 *
 * @example
 * json
 * {
 *   "type": "object",
 *   "properties": {
 *     "query": { "type": "string", "description": "The search query" }
 *   },
 *   "required": ["query"]
 * }
 * 
 */
export interface ToolParameterSchema {
  /**
   * The JSON Schema type of the parameters container.
   * Typically `"object"` for structured tool inputs.
   */
  type: string;

  /**
   * A map of parameter names to their individual JSON Schema definitions.
   * Each entry describes the type, constraints, and description of a single input field.
   */
  properties?: Record<string, unknown>;

  /**
   * List of parameter names that the model **must** provide when calling this tool.
   * Corresponds to non-optional fields in the tool's Zod `inputSchema`.
   */
  required?: string[];

  /**
   * An optional top-level description of the parameter object as a whole.
   * Rarely needed; prefer per-property descriptions inside `properties`.
   */
  description?: string;
}

/**
 * A runtime entry in the tool dispatch map, linking a registered tool to its
 * concrete instance and method name for execution.
 *
 * The framework builds a `Map<string, ToolMapEntry>` (keyed by {@link ToolMetadata.name})
 * before each agent run, enabling O(1) lookup when the model returns a tool call.
 *
 * @example
 * 
 * const entry: ToolMapEntry = {
 *   instance: new MyToolsClass(),
 *   method: 'searchWeb',
 *   metadata: { name: 'search_web', description: '...' },
 * };
 * const result = await (entry.instance as any)[entry.method](toolInput);
 * 
 */
export interface ToolMapEntry {
  /**
   * The instantiated object on which the tool method will be called.
   * `null` indicates the tool has been registered but not yet bound to an instance
   * (e.g. during static analysis or testing scenarios).
   */
  instance: object | null;

  /**
   * The name of the method on `instance` to invoke.
   * This is the JavaScript property key, not the tool's public `name`.
   *
   * @example 'searchWeb' (while the tool name sent to the model is 'search_web')
   */
  method: string;

  /**
   * The full metadata of the tool as originally provided to the `@tool()` decorator.
   * Retained here for runtime validation, logging, and composability checks.
   */
  metadata: ToolMetadata;
}
