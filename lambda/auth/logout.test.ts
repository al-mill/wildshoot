// @vitest-environment node
import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './logout';

const send = vi.spyOn(CognitoIdentityProviderClient.prototype, 'send');

const event = (headers: Record<string, string>) =>
  ({ body: null, headers }) as unknown as APIGatewayProxyEvent;

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.stubEnv('ALLOWED_ORIGIN', 'http://localhost:3000');
  });
  afterEach(() => {
    send.mockReset();
  });

  it.each(['Authorization', 'authorization'])(
    'signs out the bearer token from the %s header',
    async header => {
      send.mockResolvedValue({} as never);

      const res = await handler(event({ [header]: 'Bearer access' }));

      const command = send.mock.calls[0][0] as GlobalSignOutCommand;
      expect(command.input).toEqual({ AccessToken: 'access' });
      expect(res.statusCode).toBe(200);
    }
  );

  it('returns 401 without a bearer token', async () => {
    const res = await handler(event({}));
    expect(res.statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
});
