# 05 — Startup Evaluator (Complex Agent Pipeline)

A complex multi-agent pipeline that takes a startup idea and produces a full investment memo, simulating how an early-stage VC firm would evaluate an opportunity.

## What it does

The orchestrator receives a startup description and coordinates four specialized sub-agents in sequence:

1. **Market Analyst** — evaluates TAM, growth trend, competitors, market opportunity
2. **Tech Architect** — assesses technical feasibility, complexity, MVP timeline, stack
3. **Risk Assessor** — identifies market, technical, and regulatory risks with severity ratings
4. **Report Writer** — synthesizes all three analyses into a final investment memo

The final output is a structured memo with executive summary, highlights from each analysis, an overall score, and a verdict.

## Structure

```
05-startup-evaluator/
├── index.ts
└── behaviors/
    ├── orchestrator.md
    ├── market-analyst.md
    ├── tech-architect.md
    ├── risk-assessor.md
    └── report-writer.md
```

## Architecture

```
StartupEvaluatorAgent (orchestrator)
├── MarketAnalystAgent     → market_analysis tool
├── TechArchitectAgent     → tech_assessment tool
├── RiskAssessorAgent      → risk_assessment tool
└── ReportWriterAgent      → investment_memo tool
```

Each sub-agent exposes a single structured output tool. The orchestrator calls the first three in sequence, then passes all results to the report writer.

## Key concepts

- **4-stage pipeline** via `compose()` — the most complex agent composition in this example suite
- **Nested structured output** — tools with arrays of objects (e.g. risk items with severity)
- **`z.preprocess`** on all array fields to handle LLMs serializing arrays as JSON strings
- **Custom monitor** with `AgentRuntime(false)` for clean terminal output
- **Graceful fallback** — the monitor catches non-JSON output from the report writer and prints it as-is, since capable models may produce richer free-text memos than the structured schema allows

## Run

```bash
npx ts-node --project ../tsconfig.json 05-startup-evaluator/index.ts
```

## Expected output

```
🚀 Startup Evaluator — AI Investment Memo Generator
────────────────────────────────────────────────────────────
📄 Idea: An AI-powered personal finance app...
────────────────────────────────────────────────────────────

📊  Calling: market-analyst [21.5s]
   ✅ Done: market-analyst
🏗️  Calling: tech-architect [32.8s]
   ✅ Done: tech-architect
⚠️  Calling: risk-assessor [43.5s]
   ✅ Done: risk-assessor

════════════════════════════════════════════════════════════
📋  INVESTMENT MEMO
════════════════════════════════════════════════════════════

🏷  AI-Powered Personal Finance App
⭐  Score: 7.5/10 | Verdict: YES
💬  "Strong timing, clear gap in EU market, high regulatory risk."

📌  Executive Summary
...

⏱  Total time: 126.0s
```

## Notes

- **Total time ~2 minutes** is expected — this pipeline makes 4 LLM calls in sequence, each with its own reasoning loop
- **Report writer behavior**: smaller models (e.g. `granite4:3b`) may bypass the `investment_memo` tool and respond in free text when the schema is complex. This is handled by the `try/catch` in the monitor — the output is still valuable, just unstructured. Using a larger model for the report writer sub-agent produces more reliable structured output
- **`z.preprocess` on arrays**: critical for nested schemas. LLMs frequently serialize arrays as JSON strings (`"[\"a\",\"b\"]"`) instead of proper JSON arrays (`["a","b"]`). The preprocess step parses them transparently
- **To evaluate a different startup**: just replace the `STARTUP_IDEA` constant in `index.ts`