import "reflect-metadata";
import { z } from "zod";
import { tool, agent, compose, OllamaClient, runAgent } from "typed-agents";
import path from "path";

const MODEL = "minimax-m2.7:cloud";

// ─── Sub-agent: Summarizer ────────────────────────────────────────────────────

class SummarizerTools {
    @tool({
        name: "summarize",
        description: "Stores the final summary of the text",
        inputSchema: z.object({
            summary: z.string().describe("The concise summary of the text"),
        }),
    })
    summarize({ summary }: { summary: string }) {
        return { summary };
    }
}

@agent({
    name: "summarizer",
    llmClient: new OllamaClient(MODEL),
    tools: [SummarizerTools],
    behavior: path.join(__dirname, "behaviors", "summarizer.md"),
    maxSteps: 6,
})
class SummarizerAgent { }

// ─── Sub-agent: Sentiment ─────────────────────────────────────────────────────

class SentimentTools {
    @tool({
        name: "analyze_sentiment",
        description: "Stores the sentiment analysis result",
        inputSchema: z.object({
            sentiment: z
                .enum(["positive", "negative", "neutral", "mixed"])
                .describe("The overall sentiment of the text"),
            score: z.coerce
                .number()
                .describe("Sentiment score: -1.0 very negative, 0 neutral, 1.0 very positive"),
            reasoning: z.string().optional().describe("Brief explanation"),
        }),
    })
    analyzeSentiment(result: {
        sentiment: "positive" | "negative" | "neutral" | "mixed";
        score: number;
        reasoning?: string;
    }) {
        return result;
    }
}

@agent({
    name: "sentiment-analyzer",
    llmClient: new OllamaClient(MODEL),
    tools: [SentimentTools],
    behavior: path.join(__dirname, "behaviors", "sentiment.md"),
    maxSteps: 6,
})
class SentimentAgent { }

// ─── Orchestrator ─────────────────────────────────────────────────────────────

@agent({
    name: "text-analysis-orchestrator",
    llmClient: new OllamaClient(MODEL),
    tools: [
        compose(SummarizerAgent, {
            description: "Summarizes a given text into 2-3 concise sentences",
            maxSteps: 6,
        }),
        compose(SentimentAgent, {
            description:
                "Analyzes the sentiment of a text, returning sentiment label and score",
            maxSteps: 6,
        }),
    ],
    behavior: path.join(__dirname, "behaviors", "orchestrator.md"),
    maxSteps: 8,
})
class OrchestratorAgent { }

// ─── Run ──────────────────────────────────────────────────────────────────────

const TEXT = `
  OpenAI has released GPT-5, its most powerful model to date. 
  The new model significantly outperforms its predecessors on reasoning 
  and coding benchmarks. However, critics have raised concerns about 
  the increasing energy consumption of large AI models and the lack 
  of transparency around training data. Despite the controversy, 
  developers and enterprises have responded with overwhelming enthusiasm, 
  with the API waitlist filling up within hours of the announcement.
`;

async function main() {
    console.log("📄 Analyzing text...\n");

    const result = await runAgent(
        OrchestratorAgent,
        `Please analyze the following text:\n\n${TEXT}`
    );

    console.log("\n─── Final Report ───────────────────────────────\n");
    console.log(result);
}

main().catch(console.error);