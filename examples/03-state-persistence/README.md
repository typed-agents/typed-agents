# 03 — State Persistence

An example showing how to persist agent state to disk and resume an interrupted run from exactly where it left off.

## What it does

Two separate scripts simulate a real-world scenario where a long-running task gets interrupted and needs to be resumed:

- **`start.ts`** — starts a task processor agent with a low `maxSteps` to simulate an interruption. Saves the `runId` to `run-id.txt`.
- **`resume.ts`** — reads the `runId` from `run-id.txt` and resumes the agent from the saved state, skipping already-completed work.

The agent processes a list of topics one at a time using a `process_topic` tool, and calls a `complete` tool when all topics are done.

## Structure

```
03-state-persistence/
├── start.ts            # starts the task, saves runId to run-id.txt
├── resume.ts           # resumes from the saved runId
├── run-id.txt          # created at runtime by start.ts
└── behaviors/
    └── processor.md
```

State files are saved automatically by the framework under `.agent-runs/` in the working directory.

## Key concepts

- `persist: true` in `runAgent` options to enable disk persistence
- `resumeId` in `runAgent` options to resume from a saved run
- The resumed agent automatically skips already-completed steps — no need to re-pass the original input
- `runId` is the filename in `.agent-runs/` without the `.json` extension

## Run

```bash
# Start the task (will interrupt after maxSteps)
npx ts-node --project ../tsconfig.json 03-state-persistence/start.ts

# Resume from where it left off
npx ts-node --project ../tsconfig.json 03-state-persistence/resume.ts
```

## Expected output

**start.ts:**
```
🚀 Starting task processor...
📋 Topics to process: Quantum Computing, Renewable Energy, ...

  ✅ Processed: [Quantum Computing] — ...

💾 Run interrupted. RunId saved: <uuid>
   To resume, run: npx ts-node 03-state-persistence/resume.ts
```

**resume.ts:**
```
▶️  Resuming run: <uuid>

  ✅ Processed: [Renewable Energy] — ...
  ✅ Processed: [Gene Editing] — ...
  ...
  🏁 All done!

─── Final Report ───────────────────────────────
All five topics have been processed in order:
1. Quantum Computing — ...
2. Renewable Energy — ...
...
```

## Notes

- The resumed agent knows which topics were already processed from the saved state — it picks up exactly where it left off without re-processing completed work
- `maxSteps` in `start.ts` is intentionally low to simulate an interruption. In production, interruptions can happen for any reason (crash, timeout, resource limit)
- The `runId` must be saved without the `.json` extension — strip it with `.replace(".json", "")` when reading from the filesystem