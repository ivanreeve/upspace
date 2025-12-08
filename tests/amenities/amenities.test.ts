import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { amenitiesFixture } from '../fixtures/amenities';

const mockPrisma = {
  amenity: {
    findMany: vi.fn(),
    create: vi.fn(),
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

const { GET, POST, } = await import('@/app/api/v1/spaces/[space_id]/amenities/route');
const { DELETE, } = await import('@/app/api/v1/spaces/[space_id]/amenities/[amenity_id]/route');

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const createRequest = (url: string, init?: RequestInit) => {
  const sanitizedInit: NextRequestInit = init
    ? ({ ...init, signal: init.signal ?? undefined } as NextRequestInit)
    : undefined;
  return new NextRequest(url, sanitizedInit);
};

beforeEach(() => {
  Object.values(mockPrisma.amenity).forEach((fn) => fn.mockReset());
});

describe('GET /api/v1/spaces/{space_id}/amenities', () => {
  it('returns amenities list', async () => {
    const { spaceId, list, } = amenitiesFixture;
    mockPrisma.amenity.findMany.mockResolvedValueOnce(list);

    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities`),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { data: unknown };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      { amenity_id: list[0].id, space_id: list[0].space_id, name: list[0].name, },
      { amenity_id: list[1].id, space_id: list[1].space_id, name: list[1].name, },
    ]);
  });

  it('returns 400 for invalid space_id', async () => {
    const { invalidSpaceId, } = amenitiesFixture;
    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/amenities`),
      { params: Promise.resolve({ space_id: invalidSpaceId, }), }
    );
    expect(response.status).toBe(400);
  });
});

describe('POST /api/v1/spaces/{space_id}/amenities', () => {
  it('creates an amenity and sets Location header', async () => {
    const { spaceId, createPayload, createdAmenity, } = amenitiesFixture;
    mockPrisma.amenity.create.mockResolvedValueOnce(createdAmenity);

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { data: unknown };

    expect(response.status).toBe(201);
    expect(response.headers.get('Location')).toBe(
      `/api/v1/spaces/${spaceId}/amenities/${createdAmenity.id}`
    );
    expect(body.data).toEqual({
      amenity_id: createdAmenity.id,
      space_id: createdAmenity.space_id,
      name: createdAmenity.name,
    });
  });

  it('returns 409 when amenity name already exists', async () => {
    const { spaceId, createPayload, } = amenitiesFixture;
    const err = Object.assign(new Error('duplicate'), { code: 'P2002', });
    mockPrisma.amenity.create.mockRejectedValueOnce(err);

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('Amenity with this name already exists for the space.');
  });

  it('returns 404 when space is not found (P2003)', async () => {
    const { spaceId, createPayload, } = amenitiesFixture;
    const err = Object.assign(new Error('fk'), { code: 'P2003', });
    mockPrisma.amenity.create.mockRejectedValueOnce(err);

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Space not found.');
  });

  it('returns 400 for invalid payload', async () => {
    const { spaceId, } = amenitiesFixture;
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ name: '', }),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid space_id', async () => {
    const { invalidSpaceId, createPayload, } = amenitiesFixture;
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/amenities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: invalidSpaceId, }), }
    );
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/v1/spaces/{space_id}/amenities/{amenity_id}', () => {
  it('deletes an amenity', async () => {
    const { spaceId, amenityId, } = amenitiesFixture;
    mockPrisma.amenity.deleteMany.mockResolvedValueOnce({ count: 1, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities/${amenityId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ space_id: spaceId, amenity_id: amenityId, }), }
    );
    const body = await response.json() as { data: { deleted: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it('returns 404 when amenity not found', async () => {
    const { spaceId, amenityId, } = amenitiesFixture;
    mockPrisma.amenity.deleteMany.mockResolvedValueOnce({ count: 0, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities/${amenityId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ space_id: spaceId, amenity_id: amenityId, }), }
    );
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid ids', async () => {
    const { invalidSpaceId, invalidAmenityId, } = amenitiesFixture;
    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/amenities/${invalidAmenityId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ space_id: invalidSpaceId, amenity_id: invalidAmenityId, }), }
    );
    expect(response.status).toBe(400);
  });
});
