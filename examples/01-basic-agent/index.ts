import "reflect-metadata";
import { z } from "zod";
import { tool } from "typed-agents";
import { agent } from "typed-agents";
import { OllamaClient } from "typed-agents";
import { runAgent } from "typed-agents";

// ─── Tools ───────────────────────────────────────────────────────────────────

class CalculatorTools {
  @tool({
    name: "add",
    description: "Adds two numbers together",
    inputSchema: z.object({
      a: z.coerce.number().describe("First number"),
      b: z.coerce.number().describe("Second number"),
    }),
  })
  add({ a, b }: { a: number; b: number }) {
    return a + b;
  }

  @tool({
    name: "multiply",
    description: "Multiplies two numbers together",
    inputSchema: z.object({
      a: z.coerce.number().describe("First number"),
      b: z.coerce.number().describe("Second number"),
    }),
  })
  multiply({ a, b }: { a: number; b: number }) {
    return a * b;
  }
}

// ─── Agent ───────────────────────────────────────────────────────────────────

@agent({
  name: "calculator-agent",
  llmClient: new OllamaClient("minimax-m2.7:cloud"),
  tools: [CalculatorTools],
  maxSteps: 5,
})
class CalculatorAgent {}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  const result = await runAgent(CalculatorAgent, "What is (3 + 7) * 4?");
  console.log("Result:", result);
}

main().catch(console.error);