# 04 — Event System

An example showing how to use `AgentRuntime` directly to build a custom monitor that replaces the framework's default verbose JSON logs with clean, readable terminal output.

## What it does

Instead of using the `runAgent` shorthand, the agent is run via `AgentRuntime` directly. A custom monitor subscribes to lifecycle events and prints a structured, human-friendly output with timing information.

## Structure

```
04-event-system/
├── index.ts
└── behaviors/
    └── analyst.md
```

## Key concepts

- `AgentRuntime` for direct control over the agent lifecycle
- `runtime.on(event, handler)` to subscribe to lifecycle events
- `new AgentRuntime(false)` disables the default framework logs, leaving room for a fully custom output
- `z.preprocess` to handle LLMs that serialize arrays as JSON strings instead of proper arrays

## Available events

| Event | Payload |
|---|---|
| `agent:start` | `agent`, `input` |
| `agent:step` | `step` |
| `agent:finish` | `output` |
| `agent:max_steps` | — |
| `agent:resume` | `runId` |
| `llm:response` | `text`, `tool_calls` |
| `tool:call` | `name`, `args` |
| `tool:result` | `name`, `result` |
| `retry:attempt` | `name`, `attempt`, `error` |
| `state:saved` | `runId` |

## `AgentRuntime(false)` vs `AgentRuntime(true)`

| | `true` (default in `runAgent`) | `false` |
|---|---|---|
| Framework logs | Printed automatically | Suppressed |
| Custom events | Still fired | Still fired |
| Use case | Development/debugging | Production monitors, custom UIs |

## Run

```bash
npx ts-node --project ../tsconfig.json 04-event-system/index.ts
```

## Expected output

```
──────────────────────────────────────────────────
▶  Agent started: text-analyst
   Input: "Analyze this text: The James Webb Space Telescope..."
──────────────────────────────────────────────────

⚙  Step 1 [0.0s]
   🤖 LLM responded → 1 tool call(s)
   🔧 Calling tool: analyze
      Args: {"topic":"James Webb Space Telescope..."}
   ✅ Tool result: analyze
      → {"topic":"James Webb Space Telescope discoveries..."}

⚙  Step 2 [7.0s]
   🤖 LLM responded → "The text has been successfully analyzed..."

──────────────────────────────────────────────────
🏁 Agent finished [12.0s]
   Steps: 2 | Tool calls: 1
──────────────────────────────────────────────────

📋 Output:

Topic: James Webb Space Telescope discoveries about the universe
Keywords: James Webb Space Telescope, distant galaxies, early universe, ...
Takeaway: The James Webb Space Telescope is revolutionizing our understanding...
```

## Notes

- `z.preprocess` is used on the `keywords` field because small LLMs often serialize arrays as JSON strings (e.g. `"[\"a\",\"b\"]"` instead of `["a","b"]`). The preprocess step parses the string if needed before Zod validates it.
- The `createMonitor` function is intentionally kept separate from the agent definition — events are a cross-cutting concern and should not pollute the agent logic.
- The `elapsed()` helper tracks wall-clock time from agent start, useful for identifying slow LLM calls or tool bottlenecks.