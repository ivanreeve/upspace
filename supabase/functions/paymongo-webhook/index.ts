import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

declare const Deno: {
  serve(callback: (req: Request) => Promise<Response> | Response): void;
};

function jsonResponse(body: Record<string, unknown>, init?: Omit<ResponseInit, 'body'>) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ message: 'Method Not Allowed', }, { status: 405, });
  }

  return jsonResponse(
    {
      received: true,
      deprecated: true,
      message: 'This endpoint is deprecated. Configure PayMongo webhooks to /api/paymongo/webhook.',
    },
    { status: 200, }
  );
});

