# Contributing to typed-agents

Thank you for your interest in contributing! 🎉  
This document will help you get started quickly and make the process smooth for everyone.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Code Style](#code-style)

---

## Getting Started

Before contributing, please:

1. Read the [Code of Conduct](CODE_OF_CONDUCT.md)
2. Check existing [issues](../../issues) and [pull requests](../../pulls) to avoid duplicates
3. For large changes, **open an issue first** to discuss your approach before writing code

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/typed-agents/typed-agents.git
cd typed-agents

# Install dependencies
npm install

# Build
npm run build

# Run
npx ts-node src/index.ts
```

> Make sure you have [Ollama](https://ollama.com) running locally with a supported model, or provide your own `LLMClient`.

---

## How to Contribute

### 🐛 Reporting a Bug

Open a [GitHub Issue](../../issues/new) and include:

- A clear title and description
- Steps to reproduce the behavior
- Expected vs actual behavior
- TypeScript version, Node.js version, OS
- Any relevant logs or stack traces

### 💡 Suggesting a Feature

Open an issue with the `enhancement` label. Describe:

- The problem you're solving
- Your proposed solution
- Any alternatives you considered

### 🔌 Adding a new LLM Client

Implement the `LLMClient` interface in `src/clients/`:

```ts
import { LLMClient, LLMMessage, LLMResponse } from "./llmClient";
import { ToolDefinition } from "../tools/toolTypes";

export class MyClient implements LLMClient {
  async invoke(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: { temperature?: number }
  ): Promise<LLMResponse> {
    // your implementation
  }

  getModelIdentifier(): string {
    return "my-model";
  }
}
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `chore` | Build process, deps, tooling |

**Examples:**

```
feat(agents): add streaming support to AgentRuntime
fix(behavior-engine): handle circular extends without crashing
docs(readme): update quick start example
```

---

## Pull Request Process

1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   ```

2. **Make your changes** — keep them focused and minimal

3. **Test your changes** manually and make sure nothing is broken

4. **Update the README** if you've changed behavior or added a public API

5. **Open a PR** against `main` with:
   - A clear title following the commit convention
   - A description of *what* changed and *why*
   - Reference to the related issue (e.g. `Closes #42`)

6. A maintainer will review your PR — please be patient and responsive to feedback

> PRs that introduce breaking changes must be clearly labeled and discussed in an issue first.

---

## Project Structure

```
src/
├── agents/             # @agent decorator, runtime loop, composition
│   ├── runtime-engine/ # Tool execution, retry, caching, persistence
│   └── behavior-engine/# .md behavior parsing & merging
├── clients/            # LLMClient interface + implementations
├── tools/              # @tool decorator, registry, types
└── runtime/            # runAgent() helper
```

When adding new modules, follow the existing file-naming conventions and keep each file focused on a single responsibility.

---

## Code Style

- **TypeScript strict mode** — no `any` unless truly necessary
- **Explicit return types** on exported functions
- **Zod** for all runtime input validation
- Keep functions small and composable

---

Thank you for helping make **typed-agents** better! 🚀