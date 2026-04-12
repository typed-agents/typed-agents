# 01 — Basic Agent

A minimal example showing how to define tools and an agent, and run it with `runAgent`.

## What it does

The agent receives a math question — `"What is (3 + 7) * 4?"` — and solves it step by step using two tools:

- `add` — adds two numbers
- `multiply` — multiplies two numbers

The LLM autonomously decides which tools to call, in which order, and combines the results into a final answer.

## Key concepts

- `@tool` decorator to define typed tools with Zod schemas
- `@agent` decorator to configure the agent
- `runAgent` to execute the agent with a prompt
- `z.coerce.number()` to handle string inputs from the LLM

## Why `z.coerce.number()`?

Small LLMs often pass numeric arguments as strings (e.g. `"3"` instead of `3`). Using `z.coerce.number()` instead of `z.number()` automatically converts them, preventing validation errors.

## Run

```bash
npx ts-node --project ../tsconfig.json 01-basic-agent/index.ts
```

## Expected output

```
Result: (3 + 7) × 4 = 40

Here's the step-by-step calculation:
1. First, we add: 3 + 7 = 10
2. Then, we multiply: 10 × 4 = 40
```