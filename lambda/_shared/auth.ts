export function bearerToken(header: string | undefined): string | null {
  return /^Bearer (\S+)$/.exec(header ?? '')?.[1] ?? null;
}
