import { Ollama } from "ollama";
import type { ChatResponse, Options, ToolCall } from "ollama";
import type {
  LLMClient,
  LLMMessage,
  LLMResponse,
  StandardToolCall,
  StreamChunk,
} from "./llm.client";
import type { ToolDefinition } from "../tools/tool.types";

function normalizeToolCall(tc: ToolCall & { id?: string }): StandardToolCall {
  const argsRaw = tc.function.arguments;
  const parsedArgs: Record<string, unknown> =
    typeof argsRaw === "string"
      ? (() => {
          try { return JSON.parse(argsRaw || "{}"); }
          catch { return {}; }
        })()
      : (argsRaw ?? {});

  return {
    id: tc.id,
    function: { name: tc.function.name, arguments: parsedArgs },
  };
}

export class OllamaClient implements LLMClient {
  private ollama = new Ollama();

  constructor(private model: string, private options?: Partial<Options>) {}

  async invoke(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    const response: ChatResponse = await this.ollama.chat({
      model: this.model,
      messages,
      tools: tools as any[],
      keep_alive: -1,
      options: this.options,
    });

    return {
      text: response.message.content || "",
      tool_calls: (response.message.tool_calls ?? []).map(normalizeToolCall),
    };
  }

  /**
   * Streams text deltas token by token.
   * Tool calls are collected silently and emitted as tool_call_delta chunks,
   * then included in the final "done" chunk.
   */
  async *invokeStream(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
  ): AsyncGenerator<StreamChunk> {
    const stream = await this.ollama.chat({
      model: this.model,
      messages,
      tools: tools as any[],
      stream: true,
      keep_alive: -1,
      options: this.options,
    });

    let fullText = "";
    const collectedToolCalls: StandardToolCall[] = [];

    for await (const part of stream) {
      const delta = part.message.content ?? "";
      if (delta) {
        fullText += delta;
        yield { type: "text_delta", delta };
      }

      for (const tc of part.message.tool_calls ?? []) {
        const normalized = normalizeToolCall(tc as ToolCall & { id?: string });
        collectedToolCalls.push(normalized);
        yield { type: "tool_call_delta", tool_call: normalized };
      }
    }

    yield {
      type: "done",
      response: { text: fullText, tool_calls: collectedToolCalls },
    };
  }

  getModelIdentifier(): string {
    return this.model;
  }
}