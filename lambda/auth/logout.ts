import { GlobalSignOutCommand } from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { bearerToken } from '../_shared/auth';
import { cognito, cognitoErrorResponse } from '../_shared/cognito';
import { json } from '../_shared/response';

// Behind the authorizer, so the bearer token has already been verified.
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const accessToken = bearerToken(
    event.headers.Authorization ?? event.headers.authorization
  );
  if (!accessToken) return json(401, { message: 'Unauthorized' });

  try {
    await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
    return json(200, {});
  } catch (err) {
    return cognitoErrorResponse(err);
  }
}
