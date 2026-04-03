import fs from "fs";
import path from "path";
import { clearBehaviorCache } from "./parse-behavior";
import { Logger } from "../../core/logger/logger";

let watcher: fs.FSWatcher | null = null;

/**
 * Sets up file watching for behavior files in a directory.
 *
 * Watches for changes to .md files and clears the behavior cache on changes,
 * enabling hot-reload of behaviors during development.
 *
 * @param dir - Directory path to watch for behavior files.
 */
export function watchBehaviors(dir: string) {
  const fullPath = path.resolve(dir);

  if (watcher) return;

  Logger.info(`👀 Watching behaviors in: ${fullPath}`);

  watcher = fs.watch(
    fullPath,
    { recursive: true },
    (eventType, filename) => {
      if (!filename) return;

      if (!filename.endsWith(".md")) return;

      Logger.warn(`♻️ Behavior changed: ${filename}`);
      clearBehaviorCache();
    }
  );
}