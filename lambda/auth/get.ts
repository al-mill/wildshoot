import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getAuthContext } from '../_shared/auth';
import { json } from '../_shared/response';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  if (!auth) return json(401, { message: 'Unauthorized' });

  return json(200, {
    sub: auth.sub,
    groups: auth.groups,
    isAdmin: auth.groups.includes('admins'),
  });
}
