export function hasValidCronSecret(request: Request, secret: string | undefined) {
  if (!secret) {
    return true;
  }

  const legacySecret = request.headers.get('x-cron-secret');
  if (legacySecret === secret) {
    return true;
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return false;
  }

  const [scheme, token] = authorization.split(/\s+/u, 2);
  return scheme.toLowerCase() === 'bearer' && token === secret;
}
