export interface FetchWithRetryOptions {
  /** Total attempts including the first (default 4). */
  attempts?: number;
  /** Base backoff delay; doubles per attempt with jitter (default 500ms). */
  baseDelayMs?: number;
  /** Upper bound on a single backoff delay (default 8s). */
  maxDelayMs?: number;
  /** Per-attempt timeout (default 120s — generation endpoints are slow). */
  timeoutMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Compute the delay before the given retry, honoring a Retry-After header
 * (seconds form) when present, otherwise exponential backoff with jitter.
 */
export function retryDelayMs(
  attempt: number,
  retryAfterHeader: string | null,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, maxDelayMs);
    }
  }
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.min(exponential * jitter, maxDelayMs);
}

/**
 * fetch with per-attempt timeout and exponential-backoff retries on 429,
 * 5xx, and network errors. Non-retryable HTTP errors (4xx) are returned
 * to the caller as-is for provider-specific handling.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    baseDelayMs = 500,
    maxDelayMs = 8_000,
    timeoutMs = 120_000,
    sleep = defaultSleep,
    fetchImpl = fetch,
  } = options;
  // Always make at least one request, whatever the caller passed.
  const attempts = Math.max(1, Math.floor(options.attempts ?? 4));

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      response = await fetchImpl(url, {
        ...init,
        signal: init.signal
          ? AbortSignal.any([init.signal, timeoutSignal])
          : timeoutSignal,
      });
    } catch (err) {
      lastError = err;
      // Caller-initiated aborts are intentional; don't retry them.
      if (init.signal?.aborted) {
        throw err;
      }
      if (attempt < attempts - 1) {
        await sleep(retryDelayMs(attempt, null, baseDelayMs, maxDelayMs));
        continue;
      }
      break;
    }

    if (!isRetryableStatus(response.status) || attempt === attempts - 1) {
      return response;
    }
    // Release the connection before retrying; an unconsumed body can pin
    // sockets in undici.
    await response.body?.cancel().catch(() => {});
    await sleep(
      retryDelayMs(
        attempt,
        response.headers.get("retry-after"),
        baseDelayMs,
        maxDelayMs,
      ),
    );
  }

  throw new Error(
    `fetch failed after ${attempts} attempts: ${String(lastError)}`,
    {
      cause: lastError,
    },
  );
}
