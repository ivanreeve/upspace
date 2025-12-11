import {
beforeEach,
describe,
expect,
it,
vi
} from 'vitest';

import { MockNextRequest, MockNextResponse } from '../utils/mock-next-server';
import { amenitiesFixture } from '../fixtures/amenities';

const mockPrisma = {
  amenity: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  amenity_choice: { findUnique: vi.fn(), },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, }));
vi.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
}));

const {
 GET, POST, 
} = await import('@/app/api/v1/spaces/[space_id]/amenities/route');
const { DELETE, } = await import('@/app/api/v1/spaces/[space_id]/amenities/[amenity_id]/route');

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
  Object.values(mockPrisma.amenity).forEach((fn) => fn.mockReset());
  mockPrisma.amenity_choice.findUnique.mockReset();
});

describe('GET /api/v1/spaces/{space_id}/amenities', () => {
  it('returns amenities list', async () => {
    const {
 spaceId, list, 
} = amenitiesFixture;
    mockPrisma.amenity.findMany.mockResolvedValueOnce(list);

    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities`),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { data: unknown };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
        amenity_id: list[0].id,
        space_id: list[0].space_id,
        name: list[0].amenity_choice.name,
      },
      {
        amenity_id: list[1].id,
        space_id: list[1].space_id,
        name: list[1].amenity_choice.name,
      }
    ]);
  });

  it('returns 400 for invalid space_id', async () => {
    const { invalidSpaceId, } = amenitiesFixture;
    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/amenities`),
      { params: Promise.resolve({ space_id: invalidSpaceId, }), }
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.amenity_choice.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/spaces/{space_id}/amenities', () => {
  it('creates an amenity and sets Location header', async () => {
    const {
 spaceId, createPayload, createdAmenity, amenityChoice, 
} = amenitiesFixture;
    mockPrisma.amenity_choice.findUnique.mockResolvedValueOnce(amenityChoice);
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
      name: createdAmenity.amenity_choice.name,
    });
  });

  it('returns 409 when amenity name already exists', async () => {
    const {
 spaceId, createPayload, amenityChoice, 
} = amenitiesFixture;
    const err = Object.assign(new Error('duplicate'), { code: 'P2002', });
    mockPrisma.amenity_choice.findUnique.mockResolvedValueOnce(amenityChoice);
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
    const {
 spaceId, createPayload, amenityChoice, 
} = amenitiesFixture;
    const err = Object.assign(new Error('fk'), { code: 'P2003', });
    mockPrisma.amenity_choice.findUnique.mockResolvedValueOnce(amenityChoice);
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
    mockPrisma.amenity.create.mockImplementation(() => {
      throw new Error('amenity.create should not be called on invalid payload');
    });
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ name: '', }),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.amenity.create).not.toHaveBeenCalled();
    expect(mockPrisma.amenity_choice.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid space_id', async () => {
    const {
 invalidSpaceId, createPayload, 
} = amenitiesFixture;
    mockPrisma.amenity.create.mockImplementation(() => {
      throw new Error('amenity.create should not be called on invalid space id');
    });
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/amenities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: invalidSpaceId, }), }
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.amenity.create).not.toHaveBeenCalled();
  });

});

describe('DELETE /api/v1/spaces/{space_id}/amenities/{amenity_id}', () => {
  it('deletes an amenity', async () => {
    const {
 spaceId, amenityId, 
} = amenitiesFixture;
    mockPrisma.amenity.deleteMany.mockResolvedValueOnce({ count: 1, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities/${amenityId}`, { method: 'DELETE', }),
      {
 params: Promise.resolve({
 space_id: spaceId,
amenity_id: amenityId, 
}), 
}
    );
    const body = await response.json() as { data: { deleted: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it('returns 404 when amenity not found', async () => {
    const {
 spaceId, amenityId, 
} = amenitiesFixture;
    mockPrisma.amenity.deleteMany.mockResolvedValueOnce({ count: 0, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/amenities/${amenityId}`, { method: 'DELETE', }),
      {
 params: Promise.resolve({
 space_id: spaceId,
amenity_id: amenityId, 
}), 
}
    );
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid ids', async () => {
    const {
 invalidSpaceId, invalidAmenityId, 
} = amenitiesFixture;
    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/amenities/${invalidAmenityId}`, { method: 'DELETE', }),
      {
 params: Promise.resolve({
 space_id: invalidSpaceId,
amenity_id: invalidAmenityId, 
}), 
}
    );
    expect(response.status).toBe(400);
  });
});
