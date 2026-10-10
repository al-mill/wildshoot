import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';
import { requireEnv } from '../_shared/env';

// Module scope so the JWKS fetched on the first verify is reused by warm invocations.
const verifier = CognitoJwtVerifier.create({
  userPoolId: requireEnv('USER_POOL_ID'),
  clientId: requireEnv('CLIENT_ID'),
  tokenUse: 'access',
});

// API Gateway turns this exact message into a 401, which the frontend treats as "refresh and retry".
const unauthorized = () => new Error('Unauthorized');

export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  const token = /^Bearer (\S+)$/.exec(event.authorizationToken)?.[1];
  if (!token) throw unauthorized();

  const payload = await verifier.verify(token).catch(() => {
    throw unauthorized();
  });

  return {
    principalId: payload.sub,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: wholeStage(event.methodArn),
        },
      ],
    },
    context: {
      sub: payload.sub,
      username: payload.username,
      groups: (payload['cognito:groups'] ?? []).join(','),
    },
  };
}

// The cached decision is reused for every route, so it must allow the whole stage, not just this method.
function wholeStage(methodArn: string): string {
  const [apiArn, stage] = methodArn.split('/');
  return `${apiArn}/${stage}/*/*`;
}
