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

// The pool doesn't enable refresh-token rotation, so only new access/id tokens come back.
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { refreshToken } = parseJsonBody(event);
  if (typeof refreshToken !== 'string') return missingFields('refreshToken');

  try {
    const { AuthenticationResult: tokens } = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: requireEnv('CLIENT_ID'),
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );
    return json(200, {
      idToken: tokens?.IdToken,
      accessToken: tokens?.AccessToken,
    });
  } catch (err) {
    return cognitoErrorResponse(err);
  }
}
