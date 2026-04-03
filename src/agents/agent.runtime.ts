import { LLMClient, LLMMessage, StreamChunk } from "../clients/llm.client";
import { getAgentMetadata } from "./agent.decorator";
import { buildToolMap } from "./runtime-engine/build-tool-map";
import { executeTool } from "./runtime-engine/execute-tool";
import { Logger } from "../core/logger/logger";
import {
  AgentState,
  type AgentEvent,
  type AgentContext,
  type RunOptions,
  type PersistConfig,
  type SerializedState,
} from "./agent.types";
import { EventEmitter } from "events";
import { OllamaClient } from "../clients/ollama.client";
import { ToolDefinition, ToolMapEntry } from "../tools/tool.types";
import { buildSystemPrompt } from "./behavior-engine/build-system-prompt";
import { loadBehavior } from "./behavior-engine/load-behavior";
import { withRetry } from "./runtime-engine/retry.utils";
import { randomUUID } from "crypto";
import {
  MemoryPersister,
  FilePersister,
  NullPersister,
  type Persister,
} from "./runtime-engine/state-persistence";
import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────────────────────
// P4 — Planning / Reflection prompts
// ─────────────────────────────────────────────────────────────

/**
 * Prompt used to instruct the LLM to generate a concise step-by-step plan before execution.
 * This is injected as a user message in planning mode.
 */
const PLANNING_PROMPT =
  "Before executing, write a concise step-by-step plan (max 5 steps) in this format:\n" +
  "<plan>\n1. ...\n2. ...\n</plan>\n" +
  "Do not execute yet — just plan.";

/**
 * Prompt used to trigger self-reflection after each tool call in "reflect" planning mode.
 * Encourages the LLM to assess and potentially adjust its approach.
 */
const REFLECTION_PROMPT =
  "Reflect briefly (1-2 sentences): is your current approach optimal, " +
  "or should you adjust your next step?";

/**
 * Core runtime engine for executing agent classes decorated with `@agent()`.
 *
 * Manages the full agent lifecycle: initialization, ReAct loop, tool execution,
 * persistence, planning/reflection, and event emission. Supports both buffered
 * and streaming execution modes.
 */
export class AgentRuntime {
  private emitter = new EventEmitter();
  private subAgentCache = new Map<string, string>();
  private persister: Persister;
  private cacheDir: string | null = null;

  /**
   * Creates a new AgentRuntime instance with optional persistence configuration.
   *
   * @param showLogs - Whether to enable console logging for events and operations.
   * @param persistConfig - Configuration for state persistence (none, memory, or file).
   */
  constructor(
    private showLogs: boolean,
    persistConfig: PersistConfig = { mode: "none" },
  ) {
    // P1: NullPersister eliminates the inline anonymous object { save: async()=>{} ... }
    if (persistConfig.mode === "memory") {
      this.persister = new MemoryPersister();
    } else if (persistConfig.mode === "file") {
      const dir = persistConfig.dir ?? "./.agent-runs";
      this.persister = new FilePersister(dir);
      this.cacheDir = dir;
    } else {
      this.persister = new NullPersister();
    }
  }

  /**
   * Clears the internal cache of sub-agent results.
   * Useful for resetting state between runs or when tools change.
   */
  public clearSubAgentCache(): void {
    this.subAgentCache.clear();
    if (this.showLogs) Logger.info("Sub-agent cache cleared");
  }

  /**
   * Registers an event handler for a specific agent event type.
   *
   * @param event - The event type to listen for (e.g., "agent:start", "tool:call").
   * @param handler - Callback function invoked when the event is emitted.
   */
  on<K extends AgentEvent["type"]>(
    event: K,
    handler: (event: Extract<AgentEvent, { type: K }>) => void,
  ): void {
    this.emitter.on(event, handler as (e: AgentEvent) => void);
  }

  /**
   * Emits an agent event to all registered listeners and optionally logs it.
   *
   * @param event - The event object to emit.
   */
  private emit(event: AgentEvent): void {
    this.emitter.emit(event.type, event);
    if (this.showLogs) {
      Logger[event.log.level](`[${event.type}] ${event.log.message}`, event);
    }
  }

  /**
   * Saves the current agent state to the configured persister.
   *
   * @param runId - Unique identifier for the run.
   * @param context - Current agent context to serialize.
   * @param isFinished - Whether the run is complete.
   */
  private async saveState(
    runId: string,
    context: AgentContext,
    isFinished = false,
  ): Promise<void> {
    const serialized: SerializedState = {
      runId,
      agentName: context.agentName,
      messages: context.messages,
      state: context.state,
      step: context.step,
      timestamp: Date.now(),
      isFinished,
    };
    await this.persister.save(runId, serialized);
    context.emit({
      type: "state:saved",
      log: { level: "info", message: "State saved" },
      payload: { runId },
    });
  }

  /**
   * Saves the sub-agent cache to a JSON file in the cache directory.
   *
   * @param runId - Run ID used to name the cache file.
   */
  private async saveCache(runId: string): Promise<void> {
    if (!this.cacheDir) return;
    const file = path.join(this.cacheDir, `${runId}-cache.json`);
    await fs.promises.writeFile(
      file,
      JSON.stringify(Object.fromEntries(this.subAgentCache), null, 2),
    );
  }

  /**
   * Loads the sub-agent cache from a JSON file if it exists.
   *
   * @param runId - Run ID to identify the cache file.
   */
  private async loadCache(runId: string): Promise<void> {
    if (!this.cacheDir) return;
    const file = path.join(this.cacheDir, `${runId}-cache.json`);
    try {
      const content = await fs.promises.readFile(file, "utf-8");
      this.subAgentCache = new Map(Object.entries(JSON.parse(content)));
      if (this.showLogs) Logger.info(`Cache loaded for run ${runId}`);
    } catch {
      // Cache not found — no problem
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  /**
   * Resolves the LLM client to use, prioritizing injected client, then metadata client, then creating one from model.
   *
   * @param metadata - Agent metadata containing client or model info.
   * @param injected - Optionally injected client (overrides others).
   * @returns The resolved LLMClient instance.
   * @throws Error if no client or model is available.
   */
  private resolveClient(metadata: {
    llmClient?: LLMClient;
    model?: string;
  }, injected?: LLMClient): LLMClient {
    return (
      injected ??
      metadata.llmClient ??
      (metadata.model
        ? new OllamaClient(metadata.model)
        : (() => { throw new Error("Either llmClient or model must be provided"); })())
    );
  }

  /**
   * Builds the initial message array for the agent conversation.
   *
   * @param systemPrompt - The system prompt to include.
   * @param prompt - The user input prompt.
   * @returns Array of LLMMessage objects.
   */
  private buildInitialMessages(systemPrompt: string, prompt: string): LLMMessage[] {
    return [
      { role: "system", content: systemPrompt },
      { role: "user",   content: prompt },
    ];
  }

  // ─── P4: planning step ──────────────────────────────────────────────────

  /**
   * Asks the LLM to produce a plan before the main execution loop.
   * Best-effort: a failure here does not abort the run.
   *
   * @param context - Current agent context.
   * @param client - LLM client to use for planning.
   * @param options - Run options (for temperature, etc.).
   */
  private async executePlanningStep(
    context: AgentContext,
    client: LLMClient,
    options: RunOptions,
  ): Promise<void> {
    const planMessages: LLMMessage[] = [
      ...context.messages,
      { role: "user", content: PLANNING_PROMPT },
    ];
    try {
      const planResponse = await client.invoke(planMessages, [], { temperature: 0 });
      const plan = planResponse.text.trim();
      if (!plan) return;

      context.emit({
        type: "agent:plan",
        log: { level: "info", message: "Plan generated" },
        payload: { plan },
      });
      // Inject plan as context so the model stays on track
      context.messages.push({ role: "assistant", content: `[PLAN]\n${plan}` });
    } catch (err) {
      Logger.warn(`[AgentRuntime] Planning step failed (non-fatal): ${String(err)}`);
    }
  }

  /**
   * After a tool result, asks the LLM to self-reflect and optionally adjust.
   * Only triggered in "reflect" planning mode.
   *
   * @param context - Current agent context.
   * @param client - LLM client to use for reflection.
   */
  private async executeReflectionStep(
    context: AgentContext,
    client: LLMClient,
  ): Promise<void> {
    const reflectMessages: LLMMessage[] = [
      ...context.messages,
      { role: "user", content: REFLECTION_PROMPT },
    ];
    try {
      const reflectResponse = await client.invoke(reflectMessages, [], { temperature: 0.1 });
      const reflection = reflectResponse.text.trim();
      if (!reflection) return;

      context.emit({
        type: "agent:reflect",
        log: { level: "info", message: "Reflection.." },
        payload: { reflection },
      });
      context.messages.push({ role: "assistant", content: `[REFLECTION] ${reflection}` });
    } catch (err) {
      Logger.warn(`[AgentRuntime] Reflection step failed (non-fatal): ${String(err)}`);
    }
  }

  // ─── Core: run ──────────────────────────────────────────────────────────

  /**
   * Executes an agent class in buffered mode, returning the final output string.
   *
   * This method handles the full ReAct loop: planning (if enabled), LLM calls,
   * tool execution, reflection, persistence, and event emission. Supports resuming
   * from a previous run ID.
   *
   * @param agentClass - The agent class decorated with `@agent()`.
   * @param prompt - The user input prompt to start the conversation.
   * @param injectedClient - Optional LLM client to override the agent's default.
   * @param options - Runtime options (maxSteps, temperature, persistence, etc.).
   * @returns The final output string from the agent.
   * @throws Error if agent metadata is missing or run resumption fails.
   */
  async run(
    agentClass: new () => object,
    prompt: string,
    injectedClient?: LLMClient,
    options: RunOptions = {},
  ): Promise<string> {
    const metadata = getAgentMetadata(agentClass);
    if (!metadata) throw new Error("Agent metadata not found");

    const effectiveMaxSteps = options.maxSteps ?? metadata.maxSteps ?? 5;
    const isSilent = options.silent ?? false;
    const planningMode = options.planning ?? "none";

    let systemPrompt = metadata.systemPrompt ?? "You are a helpful AI assistant. Use tools if needed.";
    if (metadata.behavior) {
      const behavior = loadBehavior(metadata.behavior);
      systemPrompt = buildSystemPrompt(behavior);
      if (!isSilent) {
        console.log("\n🧠 SYSTEM PROMPT:\n", systemPrompt, "\n----------------------\n");
      }
    }

    const client = this.resolveClient(metadata, injectedClient);
    const toolMap = new Map<string, ToolMapEntry>();
    const tools: ToolDefinition[] = [];
    buildToolMap(metadata.tools, toolMap, tools);

    const runId = options.resumeId ?? randomUUID();
    let messages: LLMMessage[];
    let state: AgentState;
    let startStep: number;
    let isResuming = false;

    if (options.resumeId) {
      const saved = await this.persister.load(runId);
      if (!saved) throw new Error(`Run ${runId} not found`);

      // Early return if already completed
      if (saved.isFinished) {
        const lastOutput = saved.messages.at(-1)?.content ?? "No output";
        this.emit({
          type: "agent:finish",
          log: { level: "info", message: `🏁 Run ${runId} already completed` },
          payload: { output: lastOutput },
        });
        return lastOutput;
      }

      messages   = saved.messages;
      state      = saved.state;
      startStep  = saved.step;
      isResuming = true;
    } else {
      messages  = this.buildInitialMessages(systemPrompt, prompt);
      state     = { steps: 0, toolCalls: 0, startTime: Date.now() };
      startStep = 0;
    }

    const context: AgentContext = {
      agentName: metadata.name,
      input:     prompt,
      messages,
      state,
      step:      startStep,
      toolMap,
      tools,
      startTime: Date.now(),
      emit:      this.emit.bind(this),
      runId,
    };

    if (this.cacheDir) await this.loadCache(runId);

    if (isResuming) {
      context.emit({
        type: "agent:resume",
        log: { level: "info", message: `Resuming run ${runId}` },
        payload: { runId },
      });
    } else {
      context.emit({
        type: "agent:start",
        log: { level: "info", message: `Starting agent: ${metadata.name}` },
        payload: { agent: metadata.name, input: prompt },
      });
    }

    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelayMs ?? 800;
    const backoff    = options.backoff ?? true;

    // P4: optional planning step before the main loop
    if (planningMode === "basic" || planningMode === "reflect") {
      await this.executePlanningStep(context, client, options);
    }

    // ── Main ReAct loop ──────────────────────────────────────────────────
    for (let step = startStep; step < effectiveMaxSteps; step++) {
      context.step = step;
      context.state.steps++;

      context.emit({
        type: "agent:step",
        log: { level: "info", message: `Step ${step + 1} of ${effectiveMaxSteps}` },
        payload: { step },
      });

      const response = await withRetry(
        () => client.invoke(context.messages, context.tools, { temperature: options.temperature ?? 0.2 }),
        maxRetries, retryDelay, backoff,
        context.emit.bind(context),
        { name: "LLM" },
      );

      context.messages.push({
        role:       "assistant",
        content:    response.text,
        tool_calls: response.tool_calls,
      });
      context.emit({
        type: "llm:response",
        log: { level: "info", message: "LLM response received" },
        payload: response,
      });

      await this.saveState(runId, context);

      // No tool calls → final answer
      if (!response.tool_calls?.length) {
        await this.saveState(runId, context, true);
        context.emit({
          type: "agent:finish",
          log: { level: "info", message: "Agent finished" },
          payload: { output: response.text },
        });
        return response.text;
      }

      // Execute each tool call
      for (const call of response.tool_calls) {
        const toolName   = call.function.name;
        const toolArgs   = call.function.arguments;
        const toolCallId = call.id;

        context.state.toolCalls++;
        context.emit({
          type: "tool:call",
          log: { level: "info", message: `Calling tool: ${toolName}` },
          payload: { name: toolName, args: toolArgs },
        });

        // P2: executeTool now returns ToolResult, not a raw string
        const toolResult = await withRetry(
          () => executeTool(toolName, toolArgs, context.toolMap, options, this.subAgentCache),
          maxRetries, retryDelay, backoff,
          context.emit.bind(context),
          { name: toolName },
        );

        if (toolResult.ok) {
          context.emit({
            type: "tool:result",
            log: { level: "info", message: `Tool result: ${toolName}` },
            payload: { name: toolName, result: toolResult.value },
          });
          context.messages.push({
            role:         "tool",
            content:      toolResult.value,
            tool_call_id: toolCallId,
          });
        } else {
          // P2: tool errors are now explicit events, not silent string pass-throughs
          context.emit({
            type: "tool:error",
            log: { level: "warn", message: `Tool error: ${toolName} — ${toolResult.error}` },
            payload: { name: toolName, error: toolResult.error },
          });
          // Pass a structured error back to the LLM so it can adapt
          context.messages.push({
            role:         "tool",
            content:      `[TOOL ERROR] ${toolResult.error}`,
            tool_call_id: toolCallId,
          });
        }

        await this.saveState(runId, context);

        // P4: optional reflection after each tool result
        if (planningMode === "reflect") {
          await this.executeReflectionStep(context, client);
        }
      }
    }

    if (this.cacheDir && (options.persistCache ?? false)) {
      await this.saveCache(runId);
    }

    context.emit({
      type: "agent:max_steps",
      log: { level: "warn", message: `Reached max steps (${effectiveMaxSteps})` },
    });
    return "I reached the maximum number of steps without finding a final answer.";
  }

  // ─── P3: runStream ──────────────────────────────────────────────────────

  /**
   * Streaming variant of `run`. Yields:
   * - AgentEvent  for every lifecycle event (steps, tool calls, planning…)
   * - StreamChunk { type: "text_delta" } for incremental LLM text tokens
   *
   * Falls back to buffered `invoke` if the client does not implement `invokeStream`.
   *
   * Usage example:
   *   for await (const event of runtime.runStream(MyAgent, prompt)) {
   *     if (event.type === "text_delta") process.stdout.write(event.delta);
   *   }
   *
   * @param agentClass - The agent class decorated with `@agent()`.
   * @param prompt - The user input prompt.
   * @param injectedClient - Optional LLM client override.
   * @param options - Runtime options.
   * @returns Async generator yielding events and stream chunks.
   * @throws Error if agent metadata is missing.
   */
  async *runStream(
    agentClass: new () => object,
    prompt: string,
    injectedClient?: LLMClient,
    options: RunOptions = {},
  ): AsyncGenerator<AgentEvent | StreamChunk> {
    const metadata = getAgentMetadata(agentClass);
    if (!metadata) throw new Error("Agent metadata not found");

    const effectiveMaxSteps = options.maxSteps ?? metadata.maxSteps ?? 5;
    const planningMode      = options.planning ?? "none";

    let systemPrompt = metadata.systemPrompt ?? "You are a helpful AI assistant. Use tools if needed.";
    if (metadata.behavior) {
      systemPrompt = buildSystemPrompt(loadBehavior(metadata.behavior));
    }

    const client  = this.resolveClient(metadata, injectedClient);
    const toolMap = new Map<string, ToolMapEntry>();
    const tools: ToolDefinition[] = [];
    buildToolMap(metadata.tools, toolMap, tools);

    const runId    = options.resumeId ?? randomUUID();
    const messages = this.buildInitialMessages(systemPrompt, prompt);
    const state: AgentState = { steps: 0, toolCalls: 0, startTime: Date.now() };

    // Buffer for events emitted synchronously inside async operations
    const eventQueue: (AgentEvent | StreamChunk)[] = [];

    const context: AgentContext = {
      agentName: metadata.name,
      input:     prompt,
      messages,
      state,
      step:      0,
      toolMap,
      tools,
      startTime: Date.now(),
      // Override emit to both fire the EventEmitter AND buffer for the generator
      emit: (event: AgentEvent) => {
        this.emit(event);          // EventEmitter (for .on() subscribers)
        eventQueue.push(event);    // buffer for yield
      },
      runId,
    };

    const flush = function* () {
      while (eventQueue.length > 0) yield eventQueue.shift()!;
    };

    context.emit({
      type: "agent:start",
      log: { level: "info", message: `Starting agent (stream): ${metadata.name}` },
      payload: { agent: metadata.name, input: prompt },
    });
    yield* flush();

    if (planningMode === "basic" || planningMode === "reflect") {
      await this.executePlanningStep(context, client, options);
      yield* flush();
    }

    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelayMs ?? 800;
    const backoff    = options.backoff ?? true;

    for (let step = 0; step < effectiveMaxSteps; step++) {
      context.step = step;
      context.state.steps++;

      context.emit({
        type: "agent:step",
        log: { level: "info", message: `Step ${step + 1} of ${effectiveMaxSteps}` },
        payload: { step },
      });
      yield* flush();

      // ── LLM call: streaming or buffered ─────────────────────────────
      let response: import("../clients/llm.client").LLMResponse;

      if (client.invokeStream) {
        // P3: true token streaming
        const stream = client.invokeStream(context.messages, context.tools, {
          temperature: options.temperature ?? 0.2,
        });

        let doneChunk: (StreamChunk & { type: "done" }) | null = null;

        for await (const chunk of stream) {
          if (chunk.type === "text_delta") {
            yield chunk; // forward text deltas immediately
          } else if (chunk.type === "done") {
            doneChunk = chunk;
          }
          // tool_call_delta: logged via done.response.tool_calls
        }

        if (!doneChunk) throw new Error("Stream ended without a done chunk");
        response = doneChunk.response;
      } else {
        // Fallback: non-streaming invoke
        response = await withRetry(
          () => client.invoke(context.messages, context.tools, { temperature: options.temperature ?? 0.2 }),
          maxRetries, retryDelay, backoff,
          context.emit.bind(context),
          { name: "LLM" },
        );
      }

      context.messages.push({ role: "assistant", content: response.text, tool_calls: response.tool_calls });
      context.emit({
        type: "llm:response",
        log: { level: "info", message: "LLM response received" },
        payload: response,
      });
      yield* flush();

      await this.saveState(runId, context);

      if (!response.tool_calls?.length) {
        await this.saveState(runId, context, true);
        context.emit({
          type: "agent:finish",
          log: { level: "info", message: "Agent finished" },
          payload: { output: response.text },
        });
        yield* flush();
        return;
      }

      for (const call of response.tool_calls) {
        const toolName   = call.function.name;
        const toolArgs   = call.function.arguments;
        const toolCallId = call.id;

        context.state.toolCalls++;
        context.emit({
          type: "tool:call",
          log: { level: "info", message: `Calling tool: ${toolName}` },
          payload: { name: toolName, args: toolArgs },
        });
        yield* flush();

        const toolResult = await withRetry(
          () => executeTool(toolName, toolArgs, context.toolMap, options, this.subAgentCache),
          maxRetries, retryDelay, backoff,
          context.emit.bind(context),
          { name: toolName },
        );

        if (toolResult.ok) {
          context.emit({
            type: "tool:result",
            log: { level: "info", message: `Tool result: ${toolName}` },
            payload: { name: toolName, result: toolResult.value },
          });
          context.messages.push({ role: "tool", content: toolResult.value, tool_call_id: toolCallId });
        } else {
          context.emit({
            type: "tool:error",
            log: { level: "warn", message: `Tool error: ${toolName}` },
            payload: { name: toolName, error: toolResult.error },
          });
          context.messages.push({ role: "tool", content: `[TOOL ERROR] ${toolResult.error}`, tool_call_id: toolCallId });
        }
        yield* flush();

        await this.saveState(runId, context);

        if (planningMode === "reflect") {
          await this.executeReflectionStep(context, client);
          yield* flush();
        }
      }
    }

    context.emit({
      type: "agent:max_steps",
      log: { level: "warn", message: `Reached max steps (${effectiveMaxSteps})` },
    });
    yield* flush();
  }
}