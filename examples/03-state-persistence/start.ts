import "reflect-metadata";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { tool, agent, OllamaClient, runAgent } from "typed-agents";

const MODEL = "minimax-m2.7:cloud";

// ─── Tools ───────────────────────────────────────────────────────────────────

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
  maxSteps: 3,
})
class TaskProcessorAgent {}

// ─── Run ─────────────────────────────────────────────────────────────────────

const TOPICS = [
  "Quantum Computing",
  "Renewable Energy",
  "Gene Editing",
  "Space Colonization",
  "Artificial General Intelligence",
];

async function main() {
  console.log("🚀 Starting task processor...");
  console.log(`📋 Topics to process: ${TOPICS.join(", ")}\n`);

  const result = await runAgent(
    TaskProcessorAgent,
    `Process each of these topics in order: ${TOPICS.join(", ")}`,
    false,
    undefined,
    {
      persist: true,
    }
  );

  const agentRunsDir = path.join(process.cwd(), ".agent-runs");
  const runs = fs.readdirSync(agentRunsDir).sort();
  const latestRunId = runs[runs.length - 1]?.replace(".json", "");

  if (latestRunId) {
    fs.writeFileSync(path.join(__dirname, "run-id.txt"), latestRunId);
    console.log(`\n💾 Run interrupted. RunId saved: ${latestRunId}`);
    console.log(`   To resume, run: npx ts-node 03-state-persistence/resume.ts`);
  }
}

main().catch(console.error);