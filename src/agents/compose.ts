import type { ToolDependency } from "./agent.types";

/**
 * Represents a tool that wraps a dedicated agent class for composable execution.
 * When invoked, it runs the agent as a sub-agent within the parent agent's context.
 */
export interface ComposableTool {
  /** Marker property to identify composable tools. Always true. */
  __isComposable: true;
  /** The agent class to instantiate and run when the tool is called. */
  AgentClass: new () => object;
  /** Optional name for the tool (defaults to agent name). */
  name?: string;
  /** Optional description of what the tool does. */
  description?: string;
  /** Key in the input object that contains the task/prompt for the sub-agent. */
  inputKey: string;
  /** Maximum steps the sub-agent is allowed to take. */
  maxSteps?: number;
}

/**
 * Creates a composable tool from an agent class.
 *
 * This allows an agent to be used as a tool within another agent, enabling
 * hierarchical multi-agent workflows. The composed agent will be run as a
 * sub-agent when the tool is invoked.
 *
 * @param AgentClass - The agent class to compose into a tool.
 * @param options - Configuration options for the composable tool.
 * @param options.name - Optional name for the tool (defaults to agent's name).
 * @param options.description - Optional description of the tool's purpose.
 * @param options.inputKey - Key for the input task (defaults to "task").
 * @param options.maxSteps - Maximum steps for the sub-agent.
 * @returns A ToolDependency that can be used in agent options.
 */
export function compose<T extends new () => object>(
  AgentClass: T,
  options: {
    name?: string;
    description?: string;
    inputKey?: string;
    maxSteps?: number;
  } = {}
): ToolDependency {
  return {
    __isComposable: true,
    AgentClass,
    name: options.name,
    description: options.description,
    inputKey: options.inputKey ?? "task",
    maxSteps: options.maxSteps,
  } as ToolDependency;
}