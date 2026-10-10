import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthContext {
  sub: string;
  username: string;
  groups: string[];
}

// Set by authorizers/cognito.ts. API Gateway only passes scalar context values, so groups arrive comma-joined.
export function getAuthContext(
  event: APIGatewayProxyEvent
): AuthContext | null {
  const ctx = event.requestContext.authorizer;
  if (!ctx || typeof ctx.sub !== 'string') return null;

  return {
    sub: ctx.sub,
    username: typeof ctx.username === 'string' ? ctx.username : '',
    groups:
      typeof ctx.groups === 'string' && ctx.groups ? ctx.groups.split(',') : [],
  };
}
