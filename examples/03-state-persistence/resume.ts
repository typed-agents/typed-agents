import "reflect-metadata";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { tool, agent, OllamaClient, runAgent } from "typed-agents";

const MODEL = "minimax-m2.7:cloud";

// ─── Tools ─────────────────────────────────────────────

class ProcessorTools {
  @tool({
    name: "process_topic",
    description: "Processes a single topic and stores a brief note about it",
    inputSchema: z.object({
      topic: z.string().describe("The topic being processed"),
      note: z.string().describe("A one-sentence insight about the topic"),
    }),
  })
  processTopic({ topic, note }: { topic: string; note: string }) {
    console.log(`  ✅ Processed: [${topic}] — ${note}`);
    return { topic, note, processedAt: new Date().toISOString() };
  }

  @tool({
    name: "complete",
    description: "Called when all topics have been processed",
    inputSchema: z.object({
      summary: z.string().describe("Final summary of all processed topics"),
    }),
  })
  complete({ summary }: { summary: string }) {
    console.log(`\n  🏁 All done!\n  ${summary}`);
    return { summary };
  }
}

// ─── Agent ───────────────────────────────────────────────────────────────────

@agent({
  name: "task-processor",
  llmClient: new OllamaClient(MODEL),
  tools: [ProcessorTools],
  behavior: path.join(__dirname, "behaviors", "processor.md"),
  maxSteps: 10,
})
class TaskProcessorAgent {}

// ─── Resume ──────────────────────────────────────────────────────────────────

async function main() {
  const runIdPath = path.join(__dirname, "run-id.txt");

  if (!fs.existsSync(runIdPath)) {
    console.error("❌ No run-id.txt found. Run start.ts first.");
    process.exit(1);
  }

  const resumeId = fs.readFileSync(runIdPath, "utf-8").trim();
  console.log(`▶️  Resuming run: ${resumeId}\n`);

  const result = await runAgent(
    TaskProcessorAgent,
    "",
    false,
    undefined,
    {
      persist: true,
      resumeId,
    }
  );

  console.log("\n─── Final Report ───────────────────────────────\n");
  console.log(result);
}

main().catch(console.error);