// @vitest-environment node
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './login';

const send = vi.spyOn(CognitoIdentityProviderClient.prototype, 'send');

const event = (body: unknown) =>
  ({
    body: JSON.stringify(body),
    headers: {},
  }) as unknown as APIGatewayProxyEvent;

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.stubEnv('CLIENT_ID', 'test-client');
    vi.stubEnv('ALLOWED_ORIGIN', 'http://localhost:3000');
  });
  afterEach(() => {
    send.mockReset();
  });

  it('exchanges email and password for tokens', async () => {
    send.mockResolvedValue({
      AuthenticationResult: {
        IdToken: 'id',
        AccessToken: 'access',
        RefreshToken: 'refresh',
      },
    } as never);

    const res = await handler(event({ email: 'a@b.co', password: 'pw' }));

    const command = send.mock.calls[0][0] as InitiateAuthCommand;
    expect(command.input).toEqual({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: 'test-client',
      AuthParameters: { USERNAME: 'a@b.co', PASSWORD: 'pw' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe(
      'http://localhost:3000'
    );
    expect(JSON.parse(res.body)).toEqual({
      idToken: 'id',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it.each([{}, { email: 'a@b.co' }, 'not-json'])(
    'rejects body %j without calling Cognito',
    async body => {
      const res = await handler(event(body));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).code).toBe('InvalidParameterException');
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('passes Cognito client errors through with their code', async () => {
    send.mockRejectedValue(
      new NotAuthorizedException({
        message: 'Incorrect username or password.',
        $metadata: { httpStatusCode: 400 },
      })
    );

    const res = await handler(event({ email: 'a@b.co', password: 'bad' }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({
      code: 'NotAuthorizedException',
      message: 'Incorrect username or password.',
    });
  });

  it('reports a sign-in challenge it cannot complete', async () => {
    send.mockResolvedValue({ ChallengeName: 'NEW_PASSWORD_REQUIRED' } as never);
    const res = await handler(event({ email: 'a@b.co', password: 'pw' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('UnsupportedChallenge');
  });

  it('hides unexpected errors behind a 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockRejectedValue(new Error('socket hang up'));

    const res = await handler(event({ email: 'a@b.co', password: 'pw' }));

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).code).toBe('InternalError');
  });
});
