import { NextRequest } from 'next/server';
import {
beforeEach,
describe,
expect,
it,
vi
} from 'vitest';

import { rateFixture } from '../fixtures/rate';

vi.mock('next/server', () => {
  class MockNextRequest extends Request {
    constructor(input: RequestInfo, init?: RequestInit) {
      super(input, init);
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
  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

const {
 GET, POST, 
} = await import('@/app/api/v1/spaces/[space_id]/areas/[area_id]/rates/route');
const {
 PUT, DELETE, 
} = await import('@/app/api/v1/spaces/[space_id]/areas/[area_id]/rates/[rate_id]/route');

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const createRequest = (url: string, init?: RequestInit) => {
  const sanitizedInit: NextRequestInit = init
    ? ({
 ...init,
signal: init.signal ?? undefined, 
} as NextRequestInit)
    : undefined;
  return new NextRequest(url, sanitizedInit);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/spaces/{space_id}/areas/{area_id}/rate', () => {
  it('returns 410 gone', async () => {
    const {
 spaceId, areaId, 
} = rateFixture;
    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}/rate`)
    );
    const body = await response.json() as { error: string };
    expect(response.status).toBe(410);
    expect(body.error).toContain('Base rates have been removed');
  });
});

describe('POST /api/v1/spaces/{space_id}/areas/{area_id}/rate', () => {
  it('returns 410 gone', async () => {
    const {
 spaceId, areaId, 
} = rateFixture;
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}/rate`, { method: 'POST', })
    );
    expect(response.status).toBe(410);
  });
});

describe('PUT /api/v1/spaces/{space_id}/areas/{area_id}/rate/{rate_id}', () => {
  it('returns 410 gone', async () => {
    const {
 spaceId, areaId, rateId, 
} = rateFixture;
    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}/rate/${rateId}`, { method: 'PUT', })
    );
    expect(response.status).toBe(410);
  });
});

describe('DELETE /api/v1/spaces/{space_id}/areas/{area_id}/rate/{rate_id}', () => {
  it('returns 410 gone', async () => {
    const {
 spaceId, areaId, rateId, 
} = rateFixture;
    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}/rate/${rateId}`, { method: 'DELETE', })
    );
    expect(response.status).toBe(410);
  });
});
