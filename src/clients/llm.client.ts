import type { ToolDefinition } from "../tools/tool.types";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: StandardToolCall[];
  tool_call_id?: string;
}

export interface StandardToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface LLMResponse {
  text: string;
  tool_calls?: StandardToolCall[];
}

/**
 * Discriminated union emitted during streaming.
 * - text_delta:      incremental text token
 * - tool_call_delta: a tool call discovered mid-stream
 * - done:            signals end of stream with the full assembled response
 */
export type StreamChunk =
  | { type: "text_delta";      delta: string }
  | { type: "tool_call_delta"; tool_call: StandardToolCall }
  | { type: "done";            response: LLMResponse };

export interface LLMClient {
  invoke(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: { temperature?: number }
  ): Promise<LLMResponse>;

  /**
   * Optional streaming variant. Clients that support it should implement this.
   * The runtime falls back to `invoke` when this is absent.
   */
  invokeStream?(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: { temperature?: number }
  ): AsyncGenerator<StreamChunk>;

  getModelIdentifier(): string;
}