import "reflect-metadata";
import path from "path";
import { z } from "zod";
import { tool, agent, AgentRuntime, OllamaClient } from "typed-agents";

const MODEL = "minimax-m2.7:cloud";

// ─── Tools ───────────────────────────────────────────────────────────────────

class AnalystTools {
    @tool({
        name: "analyze",
        description: "Stores the analysis result of the text",
        inputSchema: z.object({
            topic: z.string().describe("The main topic of the text"),
            keywords: z.preprocess(
                (val) => (typeof val === "string" ? JSON.parse(val) : val),
                z.array(z.string())
            ).describe("3 keywords from the text"),
            takeaway: z.string().describe("One-sentence key takeaway"),
        }),
    })
    analyze(result: { topic: string; keywords: string[]; takeaway: string }) {
        return result;
    }
}

// ─── Agent ───────────────────────────────────────────────────────────────────

@agent({
    name: "text-analyst",
    llmClient: new OllamaClient(MODEL),
    tools: [AnalystTools],
    behavior: path.join(__dirname, "behaviors", "analyst.md"),
    maxSteps: 5,
})
class TextAnalystAgent { }

// ─── Custom Monitor ───────────────────────────────────────────────────────────

function createMonitor(runtime: AgentRuntime) {
    const startTime = Date.now();
    let stepCount = 0;
    let toolCallCount = 0;

    const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

    runtime.on("agent:start", (e) => {
        console.log(`\n${"─".repeat(50)}`);
        console.log(`▶  Agent started: ${e.payload.agent}`);
        console.log(`   Input: "${e.payload.input.slice(0, 60)}..."`);
        console.log(`${"─".repeat(50)}`);
    });

    runtime.on("agent:step", (e) => {
        stepCount++;
        console.log(`\n⚙  Step ${e.payload.step + 1} [${elapsed()}]`);
    });

    runtime.on("llm:response", (e) => {
        const hasTools = (e.payload.tool_calls?.length ?? 0) > 0;
        const preview = e.payload.text?.slice(0, 60) || "(no text)";
        console.log(`   🤖 LLM responded ${hasTools ? `→ ${e.payload.tool_calls?.length} tool call(s)` : `→ "${preview}"`}`);
    });

    runtime.on("tool:call", (e) => {
        toolCallCount++;
        console.log(`   🔧 Calling tool: ${e.payload.name}`);
        console.log(`      Args: ${JSON.stringify(e.payload.args).slice(0, 80)}`);
    });

    runtime.on("tool:result", (e) => {
        console.log(`   ✅ Tool result: ${e.payload.name}`);
        console.log(`      → ${JSON.stringify(e.payload.result).slice(0, 80)}`);
    });

    runtime.on("retry:attempt", (e) => {
        console.log(`   ⚠️  Retry attempt #${e.payload.attempt} — ${e.payload.error}`);
    });

    runtime.on("agent:max_steps", () => {
        console.log(`\n⛔ Max steps reached`);
    });

    runtime.on("agent:finish", (e) => {
        console.log(`\n${"─".repeat(50)}`);
        console.log(`🏁 Agent finished [${elapsed()}]`);
        console.log(`   Steps: ${stepCount} | Tool calls: ${toolCallCount}`);
        console.log(`${"─".repeat(50)}`);
        console.log(`\n📋 Output:\n`);
        console.log(e.payload.output);
    });
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const TEXT = `
  The James Webb Space Telescope has captured unprecedented images of distant galaxies,
  revealing details about the early universe never seen before. Scientists are using
  these observations to refine models of cosmic evolution and star formation.
  The telescope's infrared capabilities allow it to peer through dust clouds
  that previously obscured our view of stellar nurseries.
`;

async function main() {
    // Instead of using runAgent, we directly use AgentRuntime to have more control over the execution and monitoring
    // The `false` parameter disables the default logging of the framework, allowing our custom monitor to handle all logs  
    const runtime = new AgentRuntime(false);

    createMonitor(runtime);

    await runtime.run(TextAnalystAgent, `Analyze this text:\n${TEXT}`);
}

main().catch(console.error);