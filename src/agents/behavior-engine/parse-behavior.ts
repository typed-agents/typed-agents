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

  let content = fs.readFileSync(fullPath, "utf-8");
  content = content.replace(/\r\n/g, "\n");

  const sections: AgentBehavior = {};

  // console.log(`\n[Parser] Parsing file: ${path.basename(fullPath)}`);

  const sectionsRaw = content.split(/^#\s*/gm).slice(1);

  for (const section of sectionsRaw) {
    const lines = section.split('\n');
    const rawKey = lines[0]?.trim();
    const rawValue = lines.slice(1).join('\n').trim();

    if (!rawKey) continue;

    let key = rawKey.toLowerCase();

    if (key.includes("answer")) {
      key = "answer";
    } else if (key === "role") {
      key = "role";
    } else if (key === "rules") {
      key = "rules";
    } else if (key === "planning") {
      key = "planning";
    } else {
      continue;
    }

    const value = rawValue.trim();

    (sections as any)[key] = value;

    //console.log(`[Parser] ✓ Estratta "${key}" → ${value.length} caratteri`);
    // if (key === "answer" || value.length < 150) {
    //   console.log(`[Parser]   Preview: ${value.substring(0, 180)}${value.length > 180 ? '...' : ''}`);
    // }
  }

  // console.log(`[Parser] Sezioni estratte: ${Object.keys(sections).join(", ") || "NESSUNA"}\n`);

  let result: AgentBehavior = sections;

  if (sections.extends) {
    const parentPath = path.resolve(path.dirname(fullPath), sections.extends);
    const parent = parseBehaviorInternal(parentPath, visited);
    result = { ...parent, ...sections };
  }

  fileCache.set(fullPath, result);
  return result;
}

export function clearBehaviorCache() {
  fileCache.clear();
}
