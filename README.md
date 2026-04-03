<div align="center">

# 🤖 typed-agents

> A TypeScript framework for building AI Agents and Tools with decorators, behavior files, composable sub-agents, streaming, and persistent state.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-compatible-black?style=flat-square)](https://ollama.com/)

</div>

---

## ✨ Features

| | |
|---|---|
| 🎨 **Decorator-based** | Define agents and tools with `@agent` and `@tool` — zero boilerplate |
| 🔁 **Multi-step reasoning** | Agents loop through LLM calls and tool executions automatically |
| 🧩 **Agent composition** | Nest agents as tools inside other agents via `compose()` |
| 📄 **Behavior engine** | Define agent personality and rules in plain `.md` files |
| 💾 **State persistence** | Resume interrupted runs from memory or disk |
| ⚡ **Sub-agent caching** | Avoid redundant sub-agent calls with built-in SHA-256 caching |
| 🔄 **Retry & backoff** | Automatic exponential backoff for LLM and tool calls |
| 📡 **Event system** | Subscribe to lifecycle events at every stage of a run |
| 🔌 **Pluggable clients** | Ships with `OllamaClient`, extendable via `LLMClient` interface |

---

## 🚀 Quick Start

### 1. Define a Tool

```ts
import { tool } from "./tools/toolDecorator";
import { z } from "zod";

class MyTools {
  @tool({
    name: "get_weather",
    description: "Returns the weather for a given city",
    inputSchema: z.object({ city: z.string() }),
  })
  async getWeather({ city }: { city: string }) {
    return `Sunny in ${city}, 24°C`;
  }
}
```

### 2. Define an Agent

```ts
import { agent } from "./agents/agentDecorator";
import { OllamaClient } from "./clients/ollamaClient";

@agent({
  name: "weather-agent",
  llmClient: new OllamaClient("granite4:3b"),
  tools: [MyTools],
  maxSteps: 5,
})
class WeatherAgent {}
```

### 3. Run it

```ts
import { runAgent } from "./runtime/agentRunner";

const result = await runAgent(WeatherAgent, "What's the weather in Rome?");
console.log(result);
```

---

## 🧩 Agent Composition

Agents can be used as tools inside other agents. The orchestrator delegates tasks to specialized sub-agents automatically.

```ts
@agent({ name: "researcher", llmClient: new OllamaClient("granite4:3b") })
class Researcher {}

@agent({
  name: "orchestrator",
  llmClient: new OllamaClient("granite4:3b"),
  tools: [
    "auto",
    compose(Researcher, { description: "Deep-dive research on any topic" }),
  ],
  maxSteps: 8,
})
class Orchestrator {}

await runAgent(Orchestrator, "Research the future of AI in Italy");
```

> `"auto"` automatically registers all tools in the global registry.

---

## 📄 Behavior Files

Skip writing raw system prompts. Define how your agent thinks and speaks in a plain `.md` file:

```md
# role
You are a strict and concise research assistant.

# rules
- Never make up information
- Always cite sources when possible

# planning
Break down complex tasks before answering.

# answer
Respond in bullet points. Be brief and factual.
```

```ts
@agent({
  name: "researcher",
  llmClient: new OllamaClient("granite4:3b"),
  behavior: "./behaviors/researcher.md",  // or an array of files
})
class Researcher {}
```

Behavior files support **`extends`** for inheritance and can be **merged** from multiple sources.

---

## 💾 State Persistence

Run long tasks without fear of losing progress. Persist state to disk and resume anytime.

```ts
const result = await runAgent(MyAgent, "Do something long", true, undefined, {
  persist: true,        // saves to ./.agent-runs/
  persistCache: true,   // persists sub-agent result cache too
});
```

```ts
// Resume a previous run with its ID
await runAgent(MyAgent, "", true, undefined, {
  resumeId: "your-run-id",
});
```

| Mode | Description |
|---|---|
| `"none"` | No persistence *(default)* |
| `"memory"` | In-memory, lost on restart |
| `"file"` | Written to disk, fully resumable |

---

## 📡 Event System

Hook into every stage of an agent's lifecycle for logging, monitoring, or custom side effects.

```ts
const runtime = new AgentRuntime(true);

runtime.on("agent:start",  (e) => console.log("▶️ Started:", e.payload.agent));
runtime.on("tool:call",    (e) => console.log("🔧 Tool:", e.payload.name));
runtime.on("tool:result",  (e) => console.log("✅ Result:", e.payload.result));
runtime.on("agent:finish", (e) => console.log("🏁 Done:", e.payload.output));

await runtime.run(MyAgent, "Hello!");
```

**Available events:** `agent:start` · `agent:step` · `agent:finish` · `agent:max_steps` · `agent:resume` · `llm:response` · `tool:call` · `tool:result` · `retry:attempt` · `state:saved`

---

## ⚙️ Requirements

- **Node.js** 18+
- **TypeScript** with `experimentalDecorators` and `emitDecoratorMetadata` enabled
- **[Ollama](https://ollama.com)** running locally — or bring your own `LLMClient` implementation

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## 📜 License

Distributed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) for details.