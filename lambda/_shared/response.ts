import type { APIGatewayProxyResult } from 'aws-lambda';
import { requireEnv } from './env';

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': requireEnv('ALLOWED_ORIGIN'),
    },
    body: JSON.stringify(body),
  };
}
