export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string;
  public readonly responseBody?: string;

  constructor(status: number, statusText: string, url: string, responseBody?: string) {
    super(`HTTP Request Failed: [${status} ${statusText}] on ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.responseBody = responseBody;
  }
}

export class TimeoutError extends Error {
  public readonly url: string;
  public readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`HTTP Request Timed Out after ${timeoutMs}ms on ${url}`);
    this.name = 'TimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export interface RetryOptions {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Fetch wrapper that enforces a strict timeout using AbortController.
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchInit } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes a fetch request with exponential backoff and retry handling.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const retries = retryOptions.retries ?? 3;
  const backoffMs = retryOptions.backoffMs ?? 1000;
  const timeoutMs = retryOptions.timeoutMs ?? options.timeoutMs ?? 15000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, { ...options, timeoutMs });

      // Only retry 5xx server errors or 429 rate limits automatically
      if (!response.ok) {
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          const bodyText = await response.text().catch(() => '');
          throw new HttpError(response.status, response.statusText, url, bodyText);
        }
      }

      return response;
    } catch (err: unknown) {
      lastError = err;
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        break;
      }

      const delay = backoffMs * Math.pow(2, attempt - 1);
      console.warn(
        `⚠️ [HTTP Retry] Attempt ${attempt}/${retries} failed for ${url}: ${(err as Error).message}. Retrying in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
