import { describe, expect, it, vi } from 'vitest';
import { decodeJwtPayload, isExpiring, singleFlight } from './session';

const base64Url = (value: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const jwt = (payload: Record<string, unknown>) =>
  `${base64Url('{"alg":"RS256"}')}.${base64Url(JSON.stringify(payload))}.sig`;

const NOW_MS = 1_800_000_000_000;
const nowSeconds = NOW_MS / 1000;

describe('decodeJwtPayload', () => {
  it('decodes a base64url payload', () => {
    expect(decodeJwtPayload(jwt({ sub: 'user-1' }))).toEqual({ sub: 'user-1' });
  });

  it('keeps non-ASCII claims intact', () => {
    expect(decodeJwtPayload(jwt({ name: 'José 東京' }))).toEqual({
      name: 'José 東京',
    });
  });
});

describe('isExpiring', () => {
  it('is false for a token well inside its lifetime', () => {
    expect(isExpiring(jwt({ exp: nowSeconds + 600 }), 60, NOW_MS)).toBe(false);
  });

  it('is true inside the skew window', () => {
    expect(isExpiring(jwt({ exp: nowSeconds + 30 }), 60, NOW_MS)).toBe(true);
  });

  it('is true for an expired token', () => {
    expect(isExpiring(jwt({ exp: nowSeconds - 1 }), 60, NOW_MS)).toBe(true);
  });

  it('is true when exp is missing', () => {
    expect(isExpiring(jwt({ sub: 'user-1' }), 60, NOW_MS)).toBe(true);
  });

  it('is true for a malformed token', () => {
    expect(isExpiring('not-a-jwt', 60, NOW_MS)).toBe(true);
  });
});

describe('singleFlight', () => {
  it('shares one call between concurrent callers', async () => {
    let resolve!: (value: string) => void;
    const fn = vi.fn(
      () =>
        new Promise<string>(r => {
          resolve = r;
        })
    );
    const run = singleFlight(fn);

    const first = run();
    const second = run();
    resolve('token');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'token',
      'token',
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('starts a new call once the previous one settles', async () => {
    const fn = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const run = singleFlight(fn);

    await expect(run()).resolves.toBe('a');
    await expect(run()).resolves.toBe('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates a failure to every caller and resets', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('revoked'))
      .mockResolvedValueOnce('fresh');
    const run = singleFlight(fn);

    const results = await Promise.allSettled([run(), run()]);
    expect(results.map(r => r.status)).toEqual(['rejected', 'rejected']);
    await expect(run()).resolves.toBe('fresh');
  });
});
