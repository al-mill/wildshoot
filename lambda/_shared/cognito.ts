import {
  CognitoIdentityProviderClient,
  CognitoIdentityProviderServiceException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { json } from './response';

// Module scope so warm invocations reuse the client and its connections.
export const cognito = new CognitoIdentityProviderClient({});

// Mirrors Cognito's own { code, message } error shape, so the frontend's message map works unchanged.
export function cognitoErrorResponse(err: unknown): APIGatewayProxyResult {
  if (
    err instanceof CognitoIdentityProviderServiceException &&
    err.$fault === 'client'
  ) {
    return json(err.$metadata.httpStatusCode ?? 400, {
      code: err.name,
      message: err.message,
    });
  }
  console.error(err);
  return json(500, { code: 'InternalError', message: 'Something went wrong' });
}

export function missingFields(fields: string): APIGatewayProxyResult {
  return json(400, {
    code: 'InvalidParameterException',
    message: `${fields} required`,
  });
}
