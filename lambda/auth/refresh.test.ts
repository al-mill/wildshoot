// @vitest-environment node
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './refresh';

const send = vi.spyOn(CognitoIdentityProviderClient.prototype, 'send');

const event = (body: unknown) =>
  ({
    body: JSON.stringify(body),
    headers: {},
  }) as unknown as APIGatewayProxyEvent;

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.stubEnv('CLIENT_ID', 'test-client');
    vi.stubEnv('ALLOWED_ORIGIN', 'http://localhost:3000');
  });
  afterEach(() => {
    send.mockReset();
  });

  it('exchanges a refresh token for new access and id tokens', async () => {
    send.mockResolvedValue({
      AuthenticationResult: { IdToken: 'id', AccessToken: 'access' },
    } as never);

    const res = await handler(event({ refreshToken: 'refresh' }));

    const command = send.mock.calls[0][0] as InitiateAuthCommand;
    expect(command.input).toEqual({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: 'test-client',
      AuthParameters: { REFRESH_TOKEN: 'refresh' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      idToken: 'id',
      accessToken: 'access',
    });
  });

  it('rejects a missing refresh token without calling Cognito', async () => {
    const res = await handler(event({}));
    expect(res.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('reports a revoked refresh token as NotAuthorizedException', async () => {
    send.mockRejectedValue(
      new NotAuthorizedException({
        message: 'Refresh Token has been revoked',
        $metadata: { httpStatusCode: 400 },
      })
    );

    const res = await handler(event({ refreshToken: 'revoked' }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('NotAuthorizedException');
  });
});
