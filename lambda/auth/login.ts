import { InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  cognito,
  cognitoErrorResponse,
  missingFields,
} from '../_shared/cognito';
import { requireEnv } from '../_shared/env';
import { parseJsonBody } from '../_shared/request';
import { json } from '../_shared/response';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { email, password } = parseJsonBody(event);
  if (typeof email !== 'string' || typeof password !== 'string') {
    return missingFields('email and password');
  }

  try {
    const { AuthenticationResult: tokens, ChallengeName } = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: requireEnv('CLIENT_ID'),
        AuthParameters: { USERNAME: email, PASSWORD: password },
      })
    );
    if (!tokens) {
      return json(400, {
        code: 'UnsupportedChallenge',
        message: `Sign-in needs ${ChallengeName}`,
      });
    }
    return json(200, {
      idToken: tokens.IdToken,
      accessToken: tokens.AccessToken,
      refreshToken: tokens.RefreshToken,
    });
  } catch (err) {
    return cognitoErrorResponse(err);
  }
}
