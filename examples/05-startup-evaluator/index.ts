import "reflect-metadata";
import path from "path";
import { z } from "zod";
import { tool, agent, compose, AgentRuntime, OllamaClient } from "typed-agents";

const MODEL = "minimax-m2.7:cloud";
const b = (file: string) => path.join(__dirname, "behaviors", file);

// ─── Market Analyst ──────────────────────────────────────────────────────────

class MarketAnalystTools {
  @tool({
    name: "market_analysis",
    description: "Stores the market analysis for a startup idea",
    inputSchema: z.object({
      market_size_usd_billions: z.coerce.number().describe("Total addressable market in USD billions"),
      growth_trend: z.enum(["growing", "stable", "declining"]),
      competitors: z.preprocess(
        (v) => (typeof v === "string" ? JSON.parse(v) : v),
        z.array(z.string()).length(3)
      ).describe("3 main direct competitors"),
      opportunity_summary: z.string().describe("2-sentence summary of the market opportunity"),
      score: z.coerce.number().min(1).max(10).describe("Market attractiveness score 1-10"),
    }),
  })
  analyze(result: any) { return result; }
}

@agent({
  name: "market-analyst",
  llmClient: new OllamaClient(MODEL),
  tools: [MarketAnalystTools],
  behavior: b("market-analyst.md"),
  maxSteps: 6,
})
class MarketAnalystAgent {}

// ─── Tech Architect ───────────────────────────────────────────────────────────

class TechArchitectTools {
  @tool({
    name: "tech_assessment",
    description: "Stores the technical feasibility assessment",
    inputSchema: z.object({
      complexity: z.enum(["low", "medium", "high", "very_high"]),
      mvp_months: z.coerce.number().describe("Estimated months to ship an MVP"),
      critical_challenges: z.preprocess(
        (v) => (typeof v === "string" ? JSON.parse(v) : v),
        z.array(z.string())
      ).describe("3-5 critical technical challenges"),
      suggested_stack: z.preprocess(
        (v) => (typeof v === "string" ? JSON.parse(v) : v),
        z.array(z.string())
      ).describe("Recommended tech stack"),
      feasibility_summary: z.string().describe("2-sentence feasibility summary"),
      score: z.coerce.number().min(1).max(10).describe("Technical feasibility score 1-10"),
    }),
  })
  assess(result: any) { return result; }
}

@agent({
  name: "tech-architect",
  llmClient: new OllamaClient(MODEL),
  tools: [TechArchitectTools],
  behavior: b("tech-architect.md"),
  maxSteps: 6,
})
class TechArchitectAgent {}

// ─── Risk Assessor ────────────────────────────────────────────────────────────

class RiskAssessorTools {
  @tool({
    name: "risk_assessment",
    description: "Stores the risk assessment for a startup idea",
    inputSchema: z.object({
      market_risks: z.preprocess(
        (v) => (typeof v === "string" ? JSON.parse(v) : v),
        z.array(z.object({
          risk: z.string(),
          severity: z.enum(["low", "medium", "high", "critical"]),
        }))
      ),
      technical_risks: z.preprocess(
        (v) => (typeof v === "string" ? JSON.parse(v) : v),
        z.array(z.object({
          risk: z.string(),
          severity: z.enum(["low", "medium", "high", "critical"]),
        }))
      ),
      regulatory_risks: z.preprocess(
        (v) => (typeof v === "string" ? JSON.parse(v) : v),
        z.array(z.object({
          risk: z.string(),
          severity: z.enum(["low", "medium", "high", "critical"]),
        }))
      ),
      overall_risk_level: z.enum(["low", "moderate", "high", "very_high"]),
    }),
  })
  assess(result: any) { return result; }
}

@agent({
  name: "risk-assessor",
  llmClient: new OllamaClient(MODEL),
  tools: [RiskAssessorTools],
  behavior: b("risk-assessor.md"),
  maxSteps: 6,
})
class RiskAssessorAgent {}

// ─── Report Writer ────────────────────────────────────────────────────────────

class ReportWriterTools {
  @tool({
    name: "investment_memo",
    description: "Produces the final investment memo",
    inputSchema: z.object({
      title: z.string(),
      executive_summary: z.string().describe("3-4 sentence executive summary"),
      market_highlights: z.string().describe("Key market findings"),
      tech_highlights: z.string().describe("Key technical findings"),
      risk_highlights: z.string().describe("Key risks to watch"),
      verdict: z.enum(["strong_yes", "yes", "neutral", "no", "strong_no"]),
      score: z.coerce.number().min(1).max(10).describe("Overall score 1-10"),
      one_liner: z.string().describe("One punchy sentence summarizing the verdict"),
    }),
  })
  write(result: any) { return result; }
}

@agent({
  name: "report-writer",
  llmClient: new OllamaClient(MODEL),
  tools: [ReportWriterTools],
  behavior: b("report-writer.md"),
  maxSteps: 6,
})
class ReportWriterAgent {}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

@agent({
  name: "startup-evaluator",
  llmClient: new OllamaClient(MODEL),
  tools: [
    compose(MarketAnalystAgent, {
      description: "Analyzes market size, competitors, and growth opportunity for a startup idea",
    }),
    compose(TechArchitectAgent, {
      description: "Evaluates technical feasibility, complexity, and suggests a tech stack",
    }),
    compose(RiskAssessorAgent, {
      description: "Identifies market, technical, and regulatory risks",
    }),
    compose(ReportWriterAgent, {
      description: "Writes the final investment memo from the analyses of the other agents",
    }),
  ],
  behavior: b("orchestrator.md"),
  maxSteps: 12,
})
class StartupEvaluatorAgent {}

// ─── Monitor ─────────────────────────────────────────────────────────────────

function attachMonitor(runtime: AgentRuntime) {
  const startTime = Date.now();
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  runtime.on("tool:call", (e) => {
    const icons: Record<string, string> = {
      "market-analyst": "📊",
      "tech-architect": "🏗️",
      "risk-assessor": "⚠️",
      "report-writer": "📝",
    };
    const icon = icons[e.payload.name] ?? "🔧";
    console.log(`${icon}  Calling: ${e.payload.name} [${elapsed()}]`);
  });

  runtime.on("tool:result", (e) => {
    console.log(`   ✅ Done: ${e.payload.name}`);
  });

  runtime.on("agent:finish", (e) => {
    console.log("\n" + "═".repeat(60));
    console.log("📋  INVESTMENT MEMO");
    console.log("═".repeat(60) + "\n");

    try {
      const memo = JSON.parse(e.payload.output);
      console.log(`🏷  ${memo.title}`);
      console.log(`⭐  Score: ${memo.score}/10 | Verdict: ${memo.verdict.toUpperCase()}`);
      console.log(`💬  "${memo.one_liner}"\n`);
      console.log(`📌  Executive Summary\n${memo.executive_summary}\n`);
      console.log(`📈  Market\n${memo.market_highlights}\n`);
      console.log(`🏗  Tech\n${memo.tech_highlights}\n`);
      console.log(`⚠️   Risks\n${memo.risk_highlights}\n`);
    } catch {
      console.log(e.payload.output);
    }

    console.log("═".repeat(60));
    console.log(`⏱  Total time: ${elapsed()}`);
  });
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const STARTUP_IDEA = `
  An AI-powered personal finance app that connects to all your bank accounts
  and investments, automatically categorizes expenses using LLMs, detects
  anomalies and fraud in real time, and provides personalized saving and
  investment recommendations based on your spending patterns and financial goals.
  Target: millennials and Gen Z in Europe.
`;

async function main() {
  console.log("🚀 Startup Evaluator — AI Investment Memo Generator");
  console.log("─".repeat(60));
  console.log(`📄 Idea: ${STARTUP_IDEA.trim().slice(0, 100)}...`);
  console.log("─".repeat(60) + "\n");

  const runtime = new AgentRuntime(false);
  attachMonitor(runtime);

  await runtime.run(
    StartupEvaluatorAgent,
    `Evaluate this startup idea and produce a full investment memo:\n${STARTUP_IDEA}`
  );
}

main().catch(console.error);