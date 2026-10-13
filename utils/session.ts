export function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Unreadable tokens count as expiring so callers refresh rather than send them.
export function isExpiring(
  token: string,
  skewSeconds = 60,
  nowMs = Date.now()
): boolean {
  try {
    const { exp } = decodeJwtPayload(token);
    return typeof exp !== 'number' || exp - skewSeconds <= nowMs / 1000;
  } catch {
    return true;
  }
}

// Concurrent callers share one in-flight call instead of each starting their own.
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
