import { NextRequest } from 'next/server';
import {
beforeEach,
describe,
expect,
it,
vi
} from 'vitest';

import { areaFixture } from '../fixtures/area';

const mockPrisma = {
  area: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, }));
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
} = await import('@/app/api/v1/spaces/[space_id]/areas/route');
const {
 PUT, DELETE, 
} = await import('@/app/api/v1/spaces/[space_id]/areas/[area_id]/route');

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
  Object.values(mockPrisma.area).forEach((fn) => fn.mockReset());
});

describe('GET /api/v1/spaces/{space_id}/areas', () => {
  it('returns areas list', async () => {
    const {
 spaceId, list, 
} = areaFixture;
    mockPrisma.area.findMany.mockResolvedValueOnce(list);

    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas`),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { data: any[] };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
 area_id: list[0].id,
space_id: list[0].space_id,
name: list[0].name,
max_capacity: '20', 
},
      {
 area_id: list[1].id,
space_id: list[1].space_id,
name: list[1].name,
max_capacity: '50', 
}
    ]);
  });

  it('returns 400 for invalid space_id', async () => {
    const { invalidSpaceId, } = areaFixture;
    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/areas`),
      { params: Promise.resolve({ space_id: invalidSpaceId, }), }
    );
    expect(response.status).toBe(400);
  });
});

describe('POST /api/v1/spaces/{space_id}/areas', () => {
  it('creates an area and sets Location header', async () => {
    const {
 spaceId, createPayload, created, 
} = areaFixture;
    mockPrisma.area.create.mockResolvedValueOnce(created);

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { data: any };

    expect(response.status).toBe(201);
    expect(response.headers.get('Location')).toBe(
      `/api/v1/spaces/${spaceId}/areas/${created.id}`
    );
    expect(body.data).toEqual({
      area_id: created.id,
      space_id: created.space_id,
      name: created.name,
      max_capacity: created.max_capacity?.toString() ?? null,
    });
  });

  it('returns 404 when space not found (P2003)', async () => {
    const {
 spaceId, createPayload, 
} = areaFixture;
    const err = Object.assign(new Error('fk'), { code: 'P2003', });
    mockPrisma.area.create.mockRejectedValueOnce(err);

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid payload', async () => {
    const { spaceId, } = areaFixture;
    mockPrisma.area.create.mockImplementation(() => {
      throw new Error('area.create should not be called on invalid payload');
    });
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({
 name: '',
capacity: 'NaN', 
}),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.area.create).not.toHaveBeenCalled();
  });
});

describe('PUT /api/v1/spaces/{space_id}/areas/{area_id}', () => {
  it('updates area fields', async () => {
    const {
 spaceId, areaId, updatePayload, updated, 
} = areaFixture;
    mockPrisma.area.updateMany.mockResolvedValueOnce({ count: 1, });
    mockPrisma.area.findUnique.mockResolvedValueOnce(updated);

    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(updatePayload),
      }),
      {
 params: Promise.resolve({
 space_id: spaceId,
area_id: areaId, 
}), 
}
    );
    const body = await response.json() as { data: any };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe(updatePayload.name);
    expect(body.data.max_capacity).toBe(updatePayload.capacity);
  });

  it('returns 404 when area not found', async () => {
    const {
 spaceId, areaId, updatePayload, 
} = areaFixture;
    mockPrisma.area.updateMany.mockResolvedValueOnce({ count: 0, });

    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(updatePayload),
      }),
      {
 params: Promise.resolve({
 space_id: spaceId,
area_id: areaId, 
}), 
}
    );
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid ids', async () => {
    const {
 invalidSpaceId, invalidAreaId, updatePayload, 
} = areaFixture;
    mockPrisma.area.updateMany.mockImplementation(() => {
      throw new Error('area.updateMany should not be called on invalid ids');
    });
    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/areas/${invalidAreaId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(updatePayload),
      }),
      {
 params: Promise.resolve({
 space_id: invalidSpaceId,
area_id: invalidAreaId, 
}), 
}
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.area.updateMany).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/spaces/{space_id}/areas/{area_id}', () => {
  it('deletes an area', async () => {
    const {
 spaceId, areaId, 
} = areaFixture;
    mockPrisma.area.deleteMany.mockResolvedValueOnce({ count: 1, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}`, { method: 'DELETE', }),
      {
 params: Promise.resolve({
 space_id: spaceId,
area_id: areaId, 
}), 
}
    );

    expect(response.status).toBe(204);
  });

  it('returns 404 when area not found', async () => {
    const {
 spaceId, areaId, 
} = areaFixture;
    mockPrisma.area.deleteMany.mockResolvedValueOnce({ count: 0, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/areas/${areaId}`, { method: 'DELETE', }),
      {
 params: Promise.resolve({
 space_id: spaceId,
area_id: areaId, 
}), 
}
    );

    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid ids', async () => {
    const {
 invalidSpaceId, invalidAreaId, 
} = areaFixture;
    mockPrisma.area.deleteMany.mockImplementation(() => {
      throw new Error('area.deleteMany should not be called on invalid ids');
    });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/areas/${invalidAreaId}`, { method: 'DELETE', }),
      {
 params: Promise.resolve({
 space_id: invalidSpaceId,
 area_id: invalidAreaId, 
}), 
}
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.area.deleteMany).not.toHaveBeenCalled();
  });
});
