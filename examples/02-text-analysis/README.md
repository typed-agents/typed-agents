# 02 — Text Analysis (Agent Composition)

An example showing how to compose multiple specialized agents into an orchestrator using `compose()`.

## What it does

The orchestrator receives a text and delegates to two sub-agents in parallel:

- **Summarizer** — produces a concise 2-3 sentence summary
- **Sentiment Analyzer** — classifies the sentiment (`positive`, `negative`, `neutral`, `mixed`) with a score from `-1.0` to `1.0`

The orchestrator then combines both results into a final structured report.

## Structure

```
02-text-analysis/
├── index.ts
└── behaviors/
    ├── summarizer.md       # system prompt for the summarizer agent
    ├── sentiment.md        # system prompt for the sentiment agent
    └── orchestrator.md     # system prompt for the orchestrator
```

## Key concepts

- `compose()` to wrap a sub-agent as a tool for the orchestrator
- Behavior files (`.md`) to define agent personality and rules without writing raw system prompts
- Tools used as **structured output** — the LLM is forced to call a tool to produce its result, rather than responding in free text
- `__dirname` for portable behavior file paths, independent of where the command is launched

## Why behavior files?

Instead of writing long system prompt strings in code, behavior files let you define agent rules in plain Markdown. They support `extends` for inheritance and can be merged from multiple sources.

## Why tools as structured output?

Each sub-agent exposes a single tool (`summarize`, `analyze_sentiment`). The behavior file instructs the agent to call it immediately. This guarantees the output is always structured and parseable by the orchestrator, rather than being free-form text.

## Run

```bash
npx ts-node --project ../tsconfig.json 02-text-analysis/index.ts
```

## Expected output

```
## Analysis Results

**Summary:** OpenAI's GPT-5 release showcases significant performance improvements
on reasoning and coding benchmarks, but faces criticism over energy consumption and
training data transparency. Despite controversy, developer and enterprise interest
remains extremely high, with the API waitlist filling rapidly.

**Sentiment:** Mixed (Score: 0.6/1)
The text presents a balanced view — highlighting both the model's impressive
capabilities and developer enthusiasm alongside legitimate concerns about
environmental impact and transparency.
```

## Notes

- `z.coerce.number()` is used for the sentiment score, since small LLMs may return it as a string
- Sub-agent `maxSteps` should be set generously (6+) to give the model enough room to call its tool
- Behavior files use explicit, imperative instructions (`call the tool immediately`, `do NOT respond with text`) to guide smaller models reliably