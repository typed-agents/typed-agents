import { ToolClass, ToolMetadata } from "./tool.types";

/**
 * Internal shape of a single entry stored inside the registry for each tool method.
 * Groups the JavaScript method name with its associated metadata so both are
 * always available together during tool resolution and dispatch.
 */
interface RegisteredTool {
  /** The JavaScript property key of the decorated method on the tool class. */
  method: string;

  /** The full metadata supplied to the `@tool()` decorator for this method. */
  metadata: ToolMetadata;
}

/**
 * Global, static registry that tracks every tool method decorated with `@tool()`.
 *
 * `ToolRegistry` acts as the single source of truth for all tools known to the
 * framework. It is populated automatically at class-definition time through the
 * `@tool()` decorator — you should never need to call its methods directly in
 * application code.
 *
 * Internally it maintains a `Map` keyed by tool class constructor, so multiple
 * independent tool classes can coexist without naming collisions at the class level.
 *
 * ### Lifecycle
 * 1. A module containing a `@tool()`-decorated class is imported.
 * 2. TypeScript executes the decorator, which calls {@link ToolRegistry.registerMethod}.
 * 3. The framework later calls {@link ToolRegistry.getTools} or
 *    {@link ToolRegistry.getAllRegisteredClasses} to build the tool dispatch map
 *    for an agent run.
 * 4. In test environments, {@link ToolRegistry.clear} resets all state between tests.
 *
 * @example
 * 
 * // Inspect all tools registered on a specific class:
 * const tools = ToolRegistry.getTools(MyToolsClass);
 * tools.forEach(t => console.log(t.metadata.name));
 * 
 */
export class ToolRegistry {
  /**
   * The backing store mapping each tool class to the list of its registered methods.
   * Kept private to enforce all access through the typed static API.
   */
  private static tools = new Map<ToolClass, RegisteredTool[]>();

  /**
   * Registers a single decorated method on a tool class.
   *
   * Called automatically by the `@tool()` decorator — **do not invoke manually**
   * in production code. Each call appends the method entry to the class's existing
   * list (or creates a new list if this is the first tool on the class).
   *
   * **Side-effects / warnings:**
   * - Emits a `console.warn` if `metadata.description` is missing or empty,
   *   since a missing description degrades LLM tool-selection quality.
   * - Emits a `console.warn` if another tool with the same `metadata.name` is
   *   already registered anywhere in the registry, because duplicate names cause
   *   non-deterministic behaviour when the model invokes that tool.
   *
   * @param toolClass  - The class constructor on which the decorated method lives.
   * @param method     - The JavaScript property key of the decorated method (e.g. `'searchWeb'`).
   * @param metadata   - The full {@link ToolMetadata} passed to the `@tool()` decorator.
   */
  static registerMethod(
    toolClass: ToolClass,
    method: string,
    metadata: ToolMetadata
  ): void {
    if (!metadata.description) {
      console.warn(`[ToolRegistry] Tool "${metadata.name}" has not description`);
    }

    const existing = this.tools.get(toolClass) ?? [];
    existing.push({ method, metadata });
    this.tools.set(toolClass, existing);

    const allNames = this.getAllToolNames();
    if (allNames.filter((n) => n === metadata.name).length > 1) {
      console.warn(`[ToolRegistry] ⚠️ Duplicated tool: "${metadata.name}"`);
    }
  }

  /**
   * Returns all registered tool entries for a specific tool class.
   *
   * Use this to retrieve the tools belonging to a single class before building
   * its dispatch map or generating its tool definitions for the LLM.
   *
   * @param toolClass - The class constructor whose tools you want to retrieve.
   * @returns An array of `{ method, metadata }` entries, or an empty array if
   *          the class has no registered tools (or was never imported).
   *
   * @example
   * 
   * const entries = ToolRegistry.getTools(WebSearchTools);
   * const definitions = entries.map(e => toToolDefinition(e.metadata));
   * 
   */
  static getTools(toolClass: ToolClass): RegisteredTool[] {
    return this.tools.get(toolClass) ?? [];
  }

  /**
   * Returns the constructors of every class that has at least one registered tool.
   *
   * Useful when building a full agent tool set dynamically — iterate the result,
   * instantiate each class, and bind its tools via {@link getTools}.
   *
   * @returns An array of class constructors in insertion order.
   *
   * @example
   * 
   * const allClasses = ToolRegistry.getAllRegisteredClasses();
   * const instances = allClasses.map(Cls => new Cls());
   * 
   */
  static getAllRegisteredClasses(): ToolClass[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Returns the `name` values of every registered tool, across all classes.
   *
   * Primarily used internally for duplicate-name detection inside
   * {@link registerMethod}, but also handy for debugging or building allow-lists.
   *
   * @returns A flat array of tool name strings in registration order.
   *
   * @example
   * 
   * console.log(ToolRegistry.getAllToolNames());
   * // ['search_web', 'read_file', 'send_email']
   * 
   */
  static getAllToolNames(): string[] {
    return Array.from(this.tools.values())
      .flat()
      .map((t) => t.metadata.name);
  }

  /**
   * Removes all registered tools from the registry, resetting it to its initial state.
   *
   * **Only use this in test environments.** Calling `clear()` in production will
   * silently break any agent that relies on the cleared tools, since the decorators
   * only run once at module load time and will not re-register.
   *
   * @example
   * 
   * afterEach(() => {
   *   ToolRegistry.clear();
   * });
   * 
   */
  static clear(): void {
    this.tools.clear();
  }
}