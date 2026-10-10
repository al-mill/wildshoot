// @vitest-environment node
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './me';

const event = (authorizer: Record<string, unknown> | null) =>
  ({ requestContext: { authorizer } }) as unknown as APIGatewayProxyEvent;

describe('GET /api/me', () => {
  beforeEach(() => {
    vi.stubEnv('ALLOWED_ORIGIN', 'http://localhost:3000');
  });

  it('returns the caller from the authorizer context', async () => {
    const res = await handler(
      event({ sub: 'user-1', username: 'alex', groups: 'admins,users' })
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe(
      'http://localhost:3000'
    );
    expect(JSON.parse(res.body)).toEqual({
      sub: 'user-1',
      groups: ['admins', 'users'],
      isAdmin: true,
    });
  });

  it('reports no groups as a non-admin', async () => {
    const res = await handler(event({ sub: 'user-2', groups: '' }));
    expect(JSON.parse(res.body)).toEqual({
      sub: 'user-2',
      groups: [],
      isAdmin: false,
    });
  });

  it('returns 401 when the authorizer context is missing', async () => {
    const res = await handler(event(null));
    expect(res.statusCode).toBe(401);
  });
});
