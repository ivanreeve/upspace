export async function parseErrorMessage(
  response: Response,
  fallback = 'Something went wrong. Please try again.'
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // ignore
  }
  return fallback;
}
