/**
 * Sleeps for the specified number of milliseconds.
 *
 * @param ms - Milliseconds to sleep.
 * @returns A promise that resolves after the delay.
 */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executes a function with retry logic, emitting events on failures.
 *
 * Retries up to maxRetries times with exponential backoff if enabled.
 * Emits "retry:attempt" events for each failure, and throws on final failure.
 *
 * @param fn - The async function to execute and retry.
 * @param maxRetries - Maximum number of retry attempts.
 * @param baseDelay - Base delay in ms between retries.
 * @param backoff - Whether to use exponential backoff.
 * @param emit - Event emitter function for retry events.
 * @param context - Context object with a "name" for logging.
 * @returns The result of the successful function call.
 * @throws The last error if all retries fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  backoff: boolean,
  emit: (event: any) => void,
  context: { name: string },
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = attempt === maxRetries;
      emit({
        type: "retry:attempt",
        log: {
          level: isLast ? "error" : "warn",
          message: `🔄 Retry ${attempt + 1}/${maxRetries + 1} su ${context.name}`,
        },
        payload: {
          name: context.name,
          attempt: attempt + 1,
          error: String(err),
        },
      });

      if (isLast) throw err;

      const delay = backoff ? baseDelay * Math.pow(2, attempt) : baseDelay;
      await sleep(delay);
    }
  }
  throw new Error("Unreachable");
}
