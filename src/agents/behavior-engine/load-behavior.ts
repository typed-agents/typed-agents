import { parseBehavior } from "./parse-behavior";
import { AgentBehavior } from "./behavior.types";
import { mergeBehaviors } from "./merge-behavior";

/**
 * Module-level cache is acceptable here since behavior files are read-only at runtime.
 * We expose a clear function for unit tests and hot-reload via watchBehavior.
 */
const cache = new Map<string, AgentBehavior>();

/**
 * Loads and merges behavior configurations from file paths or names.
 *
 * Parses each behavior file, merges them into a single AgentBehavior,
 * and caches the result to avoid re-parsing. Supports single string or array of strings.
 *
 * @param input - Single behavior file path/name or array of them.
 * @returns The merged AgentBehavior configuration.
 */
export function loadBehavior(input: string | string[]): AgentBehavior {
  const key = JSON.stringify(input);
  if (cache.has(key)) return cache.get(key)!;

  const files = Array.isArray(input) ? input : [input];
  const merged = mergeBehaviors(files.map((f) => parseBehavior(f)));

  cache.set(key, merged);
  return merged;
}

/**
 * Clears the in-memory cache. Called by watchBehavior and in tests.
 */
export function clearLoadBehaviorCache(): void {
  cache.clear();
}