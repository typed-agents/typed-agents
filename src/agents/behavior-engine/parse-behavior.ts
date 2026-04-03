import fs from "fs";
import path from "path";
import { AgentBehavior } from "./behavior.types";

const fileCache = new Map<string, AgentBehavior>();

/**
 * Parses a behavior file into an AgentBehavior object, resolving extends.
 *
 * @param filePath - Path to the behavior file to parse.
 * @returns The parsed and extended AgentBehavior.
 */
export function parseBehavior(filePath: string): AgentBehavior {
  return parseBehaviorInternal(filePath, new Set());
}

/**
 * Internal recursive function to parse behavior files with cycle detection.
 *
 * Parses markdown-like sections (# ROLE, # RULES, etc.) and handles extends.
 *
 * @param filePath - Path to the behavior file.
 * @param visited - Set of visited paths to detect cycles.
 * @returns The parsed AgentBehavior.
 * @throws Error on circular extends.
 */
function parseBehaviorInternal(
  filePath: string,
  visited: Set<string>,
): AgentBehavior {
  const fullPath = path.resolve(filePath);

  if (fileCache.has(fullPath)) {
    return fileCache.get(fullPath)!;
  }

  if (visited.has(fullPath)) {
    throw new Error(`Circular behavior extends detected: ${fullPath}`);
  }

  visited.add(fullPath);

  const content = fs.readFileSync(fullPath, "utf-8");

  const sections: AgentBehavior = {};

  const regex = /^#\s*(\w+)\s*\n([\s\S]*?)(?=^#|$)/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const [, rawKey, rawValue] = match;

    if (!rawKey || !rawValue) continue;

    const key = rawKey.trim().toLowerCase() as keyof AgentBehavior;
    const value = rawValue.trim();

    (sections as any)[key] = value;
  }

  let result: AgentBehavior = sections;

  if (sections.extends) {
    const parentPath = path.resolve(path.dirname(fullPath), sections.extends);

    const parent = parseBehaviorInternal(parentPath, visited);

    result = {
      ...parent,
      ...sections,
    };
  }

  fileCache.set(fullPath, result);

  return result;
}

export function clearBehaviorCache() {
  fileCache.clear();
}
