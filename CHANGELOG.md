# Changelog

All notable changes to **typed-agents** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.2] - 2026-04-12

### Added
- fix typo in code of conduct
- fix typo in changelog
- add basic calculator agent example
- add text analysis agent example

---

## [1.0.1] - 2026-04-04

### Added
- Remove options parameter from executePlanningStep 
- Update OllamaClient to use class options

---

## [1.0.0] - 2026-04-03

### Added
- `@agent` decorator for defining agents via class metadata (`reflect-metadata`)
- `@tool` decorator for registering methods as callable tools
- `ToolRegistry` — global registry for all `@tool`-decorated methods
- `AgentRuntime` — core run loop with multi-step LLM + tool execution
- `runAgent()` — top-level convenience helper with a global singleton runtime
- `OllamaClient` implementing the `LLMClient` interface
- Zod-based input validation for tools via `convertZodToToolSchema`
- `"auto"` keyword in `tools` to auto-register all known tool classes
- **Agent composition** via `compose()` — nest agents as tools inside other agents
- **Behavior engine** — define agent personality in `.md` files with `# role`, `# rules`, `# planning`, `# answer` sections
- `extends` keyword in behavior files for inheritance, with circular reference detection
- `mergeBehaviors()` — merge multiple behavior files into a single system prompt
- `watchBehaviors(dir)` — hot-reload behavior files without restarting
- **State persistence** with three modes: `none`, `memory`, `file`
- `resumeId` option in `RunOptions` to resume an interrupted run
- Sub-agent result caching with SHA-256 keying, persisted to disk via `persistCache: true`
- `clearSubAgentCache()` method on `AgentRuntime`
- Retry logic with configurable exponential backoff for LLM calls and tool executions
- Typed event system: `agent:start`, `agent:step`, `agent:finish`, `agent:max_steps`, `agent:resume`, `llm:response`, `tool:call`, `tool:result`, `retry:attempt`, `state:saved`
- `Logger` utility with timestamped `info`, `warn`, `error` levels

---
