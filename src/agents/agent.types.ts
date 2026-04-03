import { LLMClient, LLMMessage, LLMResponse } from "../clients/llm.client";
import { ToolClass, ToolDefinition, ToolMapEntry } from "../tools/tool.types";

/**
 * Represents a tool dependency registered with an agent.
 * Can be a decorated class, an instantiated tool object, or the "auto" string
 * to allow automatic tool resolution.
 */
export type ToolDependency = ToolClass | object | "auto";

/**
 * Agent initial configuration options as provided by the user.
 * These are the settings used when creating a new agent instance.
 */
export interface AgentOptions {
  /** Unique symbolic name for the agent (e.g. "assistant", "research_agent"). */
  name: string;
  /** LLM model name to use (optional if `llmClient` is already provided). */
  model?: string;
  /** LLM client instance to use for API calls. */
  llmClient?: LLMClient;
  /** List of tools available for this agent. */
  tools?: ToolDependency[];
  /** Maximum number of reasoning steps before terminating. */
  maxSteps?: number;
  /** Optional system prompt to include at the start of the context. */
  systemPrompt?: string;
  /** Behavior directives, either a string or an array of strings. */
  behavior?: string | string[];
}

/**
 * Agent metadata after option normalization.
 * Used at runtime for validation and direct value access.
 */
export interface AgentMetadata {
  name: string;
  model?: string;
  llmClient?: LLMClient;
  tools: ToolDependency[];
  maxSteps?: number;
  systemPrompt?: string;
  behavior?: string | string[];
}

/**
 * Runtime state tracked during agent execution.
 */
export interface AgentState {
  steps: number;
  toolCalls: number;
  startTime: number;
}

/**
 * Logging level used by execution trace events.
 */
export type LogLevel = "info" | "warn" | "error";

/**
 * Basic log metadata emitted by the agent.
 */
export interface LogMeta {
  level: LogLevel;
  message: string;
}

/**
 * Persistence layer configuration.
 * - none: no persistence
 * - memory: only in-memory persistence
 * - file: persistence on filesystem
 */
export interface PersistConfig {
  mode: "none" | "memory" | "file";
  dir?: string;
  maxHistory?: number;
  persistCache?: boolean;
}

/**
 * Agent planning mode.
 * - none: standard ReAct loop
 * - basic: adds a PLAN step before execution
 * - reflect: adds a PLAN step and a REFLECTION step after each tool call
 */
export type PlanningMode = "none" | "basic" | "reflect";

/**
 * Runtime options for `agent.run()`.
 */
export interface RunOptions {
  maxSteps?: number;
  temperature?: number;
  silent?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  backoff?: boolean;
  persist?: PersistConfig | boolean;
  resumeId?: string;
  persistCache?: boolean;
  planning?: PlanningMode;
}

/**
 * Serialized snapshot of an agent run for resume and audit.
 */
export interface SerializedState {
  runId: string;
  agentName: string;
  messages: LLMMessage[];
  state: AgentState;
  step: number;
  timestamp: number;
  isFinished: boolean;
}

// ─────────────────────────────────────────────
// P2: Structured ToolResult — replaces raw string returns from executeTool.
// The runtime distinguishes success from failure precisely.
// ─────────────────────────────────────────────

/**
 * Typed result for a tool called during execution.
 */
export type ToolResult =
  | { ok: true; value: string }
  | { ok: false; error: string; toolName: string };

/**
 * Constructs a successful ToolResult.
 */
export function toolSuccess(value: string): ToolResult {
  return { ok: true, value };
}

/**
 * Constructs a failed ToolResult.
 */
export function toolFailure(toolName: string, error: string): ToolResult {
  return { ok: false, error, toolName };
}

// ─────────────────────────────────────────────
// Events — includes new: tool:error, agent:plan, agent:reflect, llm:stream_chunk
// ─────────────────────────────────────────────

/**
 * Events emitted by the agent during the lifecycle of a run.
 */
export type AgentEvent =
  | { type: "agent:start"; log: LogMeta; payload: { agent: string; input: string } }
  | { type: "agent:step"; log: LogMeta; payload: { step: number } }
  | { type: "agent:plan"; log: LogMeta; payload: { plan: string } }
  | { type: "agent:reflect"; log: LogMeta; payload: { reflection: string } }
  | { type: "agent:finish"; log: LogMeta; payload: { output: string } }
  | { type: "agent:max_steps"; log: LogMeta }
  | { type: "agent:resume"; log: LogMeta; payload: { runId: string } }
  | { type: "llm:response"; log: LogMeta; payload: LLMResponse }
  | { type: "llm:stream_chunk"; log: LogMeta; payload: { delta: string } }
  | { type: "tool:call"; log: LogMeta; payload: { name: string; args: unknown } }
  | { type: "tool:result"; log: LogMeta; payload: { name: string; result: string } }
  | { type: "tool:error"; log: LogMeta; payload: { name: string; error: string } }
  | { type: "retry:attempt"; log: LogMeta; payload: { name: string; attempt: number; error: string } }
  | { type: "state:saved"; log: LogMeta; payload: { runId: string } };

/**
 * Context passed to every agent execution callback.
 */
export interface AgentContext {
  agentName: string;
  input: string;
  messages: LLMMessage[];
  state: AgentState;
  step: number;
  toolMap: Map<string, ToolMapEntry>;
  tools: ToolDefinition[];
  startTime: number;
  emit: <E extends AgentEvent>(event: E) => void;
  runId: string;
}

/**
 * Type guard to identify a composable sub-agent tool.
 */
export function isComposableTool(t: ToolDependency): t is ComposableTool {
  return (
    typeof t === "object" &&
    t !== null &&
    "__isComposable" in t &&
    (t as ComposableTool).__isComposable === true
  );
}

/**
 * Data structure representing a composable tool that wraps a dedicated agent.
 */
export interface ComposableTool {
  __isComposable: true;
  AgentClass: new () => object;
  name?: string;
  description?: string;
  inputKey: string;
  maxSteps?: number;
}
