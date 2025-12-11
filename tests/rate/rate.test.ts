import {
beforeEach,
describe,
expect,
it,
vi
} from 'vitest';

import { MockNextRequest, MockNextResponse } from '../utils/mock-next-server';
import { rateFixture } from '../fixtures/rate';

vi.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
}));

const {
 GET, POST, 
} = await import('@/app/api/v1/spaces/[space_id]/areas/[area_id]/rates/route');
const {
 PUT, DELETE, 
} = await import('@/app/api/v1/spaces/[space_id]/areas/[area_id]/rates/[rate_id]/route');

type NextRequestInit = ConstructorParameters<typeof MockNextRequest>[1];

const createRequest = (url: string, init?: RequestInit) => {
  const sanitizedInit: NextRequestInit = init
    ? ({
 ...init,
signal: init.signal ?? undefined, 
} as NextRequestInit)
    : undefined;
  return new MockNextRequest(url, sanitizedInit);
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
