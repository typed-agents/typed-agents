import fs from "fs";
import path from "path";
import { SerializedState } from "../agent.types";

/**
 * Interface for state persistence implementations.
 * Allows saving/loading agent run states and listing run IDs.
 */
export interface Persister {
  /**
   * Saves a serialized state for a given run ID.
   * @param runId - Unique identifier for the run.
   * @param state - The serialized state to save.
   */
  save(runId: string, state: SerializedState): Promise<void>;

  /**
   * Loads a serialized state for a given run ID, or null if not found.
   * @param runId - Unique identifier for the run.
   * @returns The loaded state or null.
   */
  load(runId: string): Promise<SerializedState | null>;

  /**
   * Returns all available run IDs.
   * @returns Array of run ID strings.
   */
  getAllRunIds(): string[];
}

/**
 * In-memory persister using a Map. Each instance has its own store,
 * preventing shared state between parallel AgentRuntime instances.
 * Uses structuredClone to avoid accidental mutations.
 */
export class MemoryPersister implements Persister {
  private store = new Map<string, SerializedState>();

  async save(runId: string, state: SerializedState): Promise<void> {
    this.store.set(runId, structuredClone(state));
  }

  async load(runId: string): Promise<SerializedState | null> {
    const entry = this.store.get(runId);
    return entry ? structuredClone(entry) : null;
  }

  getAllRunIds(): string[] {
    return Array.from(this.store.keys());
  }
}

/**
 * File-based persister that saves states as JSON files in a directory.
 * Creates the directory if it doesn't exist.
 */
export class FilePersister implements Persister {
  constructor(private baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  async save(runId: string, state: SerializedState): Promise<void> {
    const file = path.join(this.baseDir, `${runId}.json`);
    await fs.promises.writeFile(file, JSON.stringify(state, null, 2));
  }

  async load(runId: string): Promise<SerializedState | null> {
    const file = path.join(this.baseDir, `${runId}.json`);
    try {
      const content = await fs.promises.readFile(file, "utf-8");
      return JSON.parse(content) as SerializedState;
    } catch {
      return null;
    }
  }

  getAllRunIds(): string[] {
    return fs
      .readdirSync(this.baseDir)
      .filter((f) => f.endsWith(".json") && !f.includes("-cache"))
      .map((f) => f.replace(".json", ""));
  }
}

/**
 * Null-object pattern persister for "none" mode.
 * Does nothing, replacing the inline anonymous object.
 */
export class NullPersister implements Persister {
  async save(): Promise<void> {}
  async load(): Promise<null> { return null; }
  getAllRunIds(): string[] { return []; }
}