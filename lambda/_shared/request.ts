import type { APIGatewayProxyEvent } from 'aws-lambda';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonBody(
  event: APIGatewayProxyEvent
): Record<string, unknown> {
  try {
    const body: unknown = JSON.parse(event.body ?? '{}');
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}
