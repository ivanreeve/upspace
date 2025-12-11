class MockNextRequest extends Request {
  public readonly nextUrl: URL;

  constructor(input: RequestInfo, init?: RequestInit) {
    super(input, init);
    const rawUrl = typeof input === 'string' ? input : input.url;
    this.nextUrl = new URL(rawUrl ?? 'http://localhost');
  }
}

class MockNextResponse extends Response {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
  }

  static json(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: {
        ...(init?.headers ?? {}),
        'content-type': 'application/json',
      },
    });
  }
}

export { MockNextRequest, MockNextResponse };
