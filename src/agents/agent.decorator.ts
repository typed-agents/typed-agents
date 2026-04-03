import "reflect-metadata";
import { AgentOptions, AgentMetadata } from "./agent.types";

const AGENT_METADATA_KEY = Symbol("typed-agents:agent");

/**
 * Class decorator to declare an agent and attach normalized metadata.
 *
 * This decorator stores the agent settings (name, model, tools, etc.) as
 * metadata so that runtime factory code can discover an agent class.
 *
 * @param options - User-provided agent configuration.
 */
export function agent(options: AgentOptions) {
  return function <T extends new (...args: never[]) => object>(constructor: T) {
    const metadata: AgentMetadata = {
      name: options.name,
      model: options.model,
      llmClient: options.llmClient,
      tools: options.tools ?? [],
      maxSteps: options.maxSteps ?? 5,
      systemPrompt: options.systemPrompt,
      behavior: options.behavior,
    };

    Reflect.defineMetadata(AGENT_METADATA_KEY, metadata, constructor);
  };
}

/**
 * Reads agent metadata attached to a class or instance by the `@agent()` decorator.
 *
 * @param target - Constructor or object to inspect for metadata.
 * @returns The agent metadata, or undefined if not decorated.
 */
export function getAgentMetadata<T extends object>(
  target: T,
): AgentMetadata | undefined {
  return Reflect.getMetadata(AGENT_METADATA_KEY, target) as
    | AgentMetadata
    | undefined;
}
