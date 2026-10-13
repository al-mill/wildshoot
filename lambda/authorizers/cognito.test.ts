// @vitest-environment node
import type { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './cognito';

const verify = vi.hoisted(() => {
  process.env.USER_POOL_ID = 'us-west-2_test';
  process.env.CLIENT_ID = 'test-client';
  return vi.fn();
});

vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: () => ({ verify }) },
}));

const METHOD_ARN =
  'arn:aws:execute-api:us-west-2:123456789012:abc123/staging/GET/api/auth';

const event = (authorizationToken: string): APIGatewayTokenAuthorizerEvent => ({
  type: 'TOKEN',
  authorizationToken,
  methodArn: METHOD_ARN,
});

describe('cognito authorizer', () => {
  beforeEach(() => {
    verify.mockReset();
  });

  it.each(['', 'raw-token', 'Basic abc', 'Bearer '])(
    'rejects header %j without verifying',
    async header => {
      await expect(handler(event(header))).rejects.toThrow('Unauthorized');
      expect(verify).not.toHaveBeenCalled();
    }
  );

  it('rejects a token that fails verification', async () => {
    verify.mockRejectedValue(new Error('Token expired'));
    await expect(handler(event('Bearer expired'))).rejects.toThrow(
      'Unauthorized'
    );
  });

  it('allows the whole stage and passes user context', async () => {
    verify.mockResolvedValue({
      sub: 'user-1',
      username: 'alex',
      'cognito:groups': ['admins', 'users'],
    });

    const result = await handler(event('Bearer good-token'));

    expect(verify).toHaveBeenCalledWith('good-token');
    expect(result.principalId).toBe('user-1');
    expect(result.policyDocument.Statement).toEqual([
      {
        Action: 'execute-api:Invoke',
        Effect: 'Allow',
        Resource:
          'arn:aws:execute-api:us-west-2:123456789012:abc123/staging/*/*',
      },
    ]);
    expect(result.context).toEqual({
      sub: 'user-1',
      username: 'alex',
      groups: 'admins,users',
    });
  });

  it('passes an empty group list when the user has no groups', async () => {
    verify.mockResolvedValue({ sub: 'user-2', username: 'sam' });
    const result = await handler(event('Bearer good-token'));
    expect(result.context?.groups).toBe('');
  });
});
