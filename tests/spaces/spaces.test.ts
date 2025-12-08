import { NextRequest } from 'next/server';
import {
beforeEach,
describe,
expect,
it,
vi
} from 'vitest';

import { spaceFixtures } from '../fixtures/space';

type SupabaseAuthUser = { id: string };
type SupabaseAuthResponse = { data: { user: SupabaseAuthUser | null }; error: null };

const mockPrisma = {
  space: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  review: { groupBy: vi.fn(), },
  bookmark: { findMany: vi.fn(), },
  user: { findFirst: vi.fn(), },
  amenity_choice: { findMany: vi.fn(), },
  amenity: { createMany: vi.fn(), },
  space_availability: { createMany: vi.fn(), },
  space_image: { createMany: vi.fn(), },
  verification: { create: vi.fn(), },
  verification_document: { createMany: vi.fn(), },
  $transaction: vi.fn(),
};

const mockSupabaseClient = { auth: { getUser: vi.fn<() => Promise<SupabaseAuthResponse>>(), }, };

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn(async () => mockSupabaseClient), }));
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
vi.mock('@/lib/spaces/location', () => ({ updateSpaceLocationPoint: vi.fn(), }));
vi.mock('@/lib/rich-text', () => ({
  sanitizeRichText: vi.fn(() => 'Sanitized'),
  richTextPlainTextLength: vi.fn(() => 25),
}));
vi.mock('@/lib/spaces/image-urls', () => ({
  resolveSignedImageUrls: vi.fn(async () => new Map<string, string>()),
  buildPublicObjectUrl: vi.fn((path: string) => `https://cdn.test/${path}`),
  isAbsoluteUrl: vi.fn((path: string) => path.startsWith('http')),
}));
vi.mock('@/lib/spaces/partner-serializer', () => ({ deriveSpaceStatus: vi.fn(() => 'approved'), }));
vi.mock('@/lib/spaces/pricing', () => ({ computeStartingPriceFromAreas: vi.fn(() => 100), }));
vi.mock('@/data/spaces', () => ({ WEEKDAY_ORDER: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], }));

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
(globalThis as unknown as { HttpError?: typeof HttpError }).HttpError = HttpError;

const {
 GET, POST, 
} = await import('@/app/api/v1/spaces/route');
const {
 GET: GET_BY_ID, PUT, DELETE, 
} = await import('@/app/api/v1/spaces/[space_id]/route');
const { createSupabaseServerClient, } = await import('@/lib/supabase/server');
const mockedSupabaseServerClient = vi.mocked(createSupabaseServerClient);

const defaultTransaction = async (fn: any) => {
  if (typeof fn === 'function') {
    return fn(mockPrisma as never);
  }
  return fn;
};

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

const setAuthUser = (authUserId: string | null) => {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: authUserId ? { id: authUserId, } : null, },
    error: null,
  });
};

beforeEach(() => {
  Object.values(mockPrisma).forEach((value) => {
    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as any).mockReset();
        }
      });
    }
  });
  mockPrisma.$transaction.mockImplementation(defaultTransaction);
  mockSupabaseClient.auth.getUser.mockReset();
  mockedSupabaseServerClient.mockClear();
});

describe('GET /api/v1/spaces', () => {
  it('returns paginated spaces with derived fields', async () => {
    const {
 listResult, partner, 
} = spaceFixtures;
    mockPrisma.space.findMany.mockResolvedValueOnce(listResult);
    mockPrisma.review.groupBy.mockResolvedValueOnce([
      {
 space_id: listResult[0].id,
_avg: { rating_star: 4.5, },
_count: { rating_star: 2, }, 
}
    ]);
    mockPrisma.bookmark.findMany.mockResolvedValueOnce([{ space_id: listResult[0].id, }]);
    setAuthUser(partner.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: partner.userId, });

    const response = await GET(createRequest('http://localhost/api/v1/spaces?limit=1'));
    const body = await response.json() as { data: unknown; nextCursor: string | null };

    expect(response.status).toBe(200);
    expect(body.nextCursor).toBeNull();
    expect(body.data).toEqual([
      expect.objectContaining({
        space_id: listResult[0].id,
        name: listResult[0].name,
        image_url: 'https://cdn.test/images/space-1.png',
        average_rating: 4.5,
        total_reviews: 2,
        starting_price: 100,
        isBookmarked: true,
      })
    ]);
  });

  it('returns 400 for invalid availability range', async () => {
    const response = await GET(createRequest('http://localhost/api/v1/spaces?available_from=10:00&available_to=09:00'));
    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/spaces/{space_id}', () => {
  it('returns space details', async () => {
    const { singleResult, } = spaceFixtures;
    mockPrisma.space.findUnique.mockResolvedValueOnce(singleResult);

    const response = await GET_BY_ID(
      createRequest('http://localhost/api/v1/spaces/11111111-1111-4111-8111-111111111111'),
      { params: Promise.resolve({ space_id: singleResult.id, }), }
    );
    const body = await response.json() as { data: unknown };

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      space_id: singleResult.id,
      user_id: singleResult.user_id.toString(),
      name: singleResult.name,
      unit_number: singleResult.unit_number,
      street: singleResult.street,
      address_subunit: singleResult.address_subunit,
      city: singleResult.city,
      region: singleResult.region,
      country_code: singleResult.country_code,
      postal_code: singleResult.postal_code,
      created_at: singleResult.created_at.toISOString(),
      updated_at: singleResult.updated_at.toISOString(),
    });
  });

  it('returns 404 when space is missing', async () => {
    mockPrisma.space.findUnique.mockResolvedValueOnce(null);
    const response = await GET_BY_ID(
      createRequest('http://localhost/api/v1/spaces/11111111-1111-4111-8111-111111111111'),
      { params: Promise.resolve({ space_id: '11111111-1111-4111-8111-111111111111', }), }
    );
    const body = await response.json() as { error: string };
    expect(response.status).toBe(404);
    expect(body.error).toBe('Space not found');
  });
});

describe('POST /api/v1/spaces', () => {
  it('creates a space and sets Location header', async () => {
    const {
 createPayload, createdSpace, partner, 
} = spaceFixtures;
    setAuthUser(partner.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      user_id: partner.userId,
      role: 'partner',
      is_onboard: true,
    });
    mockPrisma.amenity_choice.findMany.mockResolvedValueOnce(
      createPayload.amenities.map((id) => ({ id, }))
    );
    mockPrisma.space.create.mockResolvedValueOnce(createdSpace);
    mockPrisma.verification.create.mockResolvedValueOnce({ id: 'v-1', });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    const response = await POST(
      createRequest('http://localhost/api/v1/spaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      })
    );
    const body = await response.json() as { data: any };

    expect(response.status).toBe(201);
    expect(response.headers.get('Location')).toBe(`/api/v1/spaces/${createdSpace.id}`);
    expect(body.data.space_id).toBe(createdSpace.id);
  });

  it('requires authentication', async () => {
    setAuthUser(null);
    const response = await POST(
      createRequest('http://localhost/api/v1/spaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(spaceFixtures.createPayload),
      })
    );
    const body = await response.json() as { error: string };
    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required.');
  });

  it('returns 422 when amenities do not match choices', async () => {
    const {
 createPayload, partner, 
} = spaceFixtures;
    setAuthUser(partner.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      user_id: partner.userId,
      role: 'partner',
      is_onboard: true,
    });
    mockPrisma.space.create.mockResolvedValueOnce(spaceFixtures.createdSpace);
    // Only one amenity returned, causing mismatch
    mockPrisma.amenity_choice.findMany.mockResolvedValueOnce([{ id: createPayload.amenities[0], }]);

    const response = await POST(
      createRequest('http://localhost/api/v1/spaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      })
    );

    expect(response.status).toBe(422);
    expect(mockPrisma.amenity_choice.findMany).toHaveBeenCalledWith({
      where: { id: { in: createPayload.amenities, }, },
      select: { id: true, },
    });
    expect(mockPrisma.space.create).toHaveBeenCalled();
  });
});

describe('PUT /api/v1/spaces/{space_id}', () => {
  it('updates space fields', async () => {
    const {
 validSpaceId, updatePayload, 
} = spaceFixtures;
    const updated = {
      ...spaceFixtures.singleResult,
      ...updatePayload,
      updated_at: new Date('2024-11-05T00:00:00.000Z'),
    };
    mockPrisma.space.update.mockResolvedValueOnce(updated);

    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${validSpaceId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(updatePayload),
      }),
      { params: Promise.resolve({ space_id: validSpaceId, }), }
    );
    const body = await response.json() as { data: any };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe(updatePayload.name);
    expect(body.data.street).toBe(updatePayload.street);
  });

  it('returns 400 when no fields provided', async () => {
    const { validSpaceId, } = spaceFixtures;
    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${validSpaceId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ space_id: validSpaceId, }), }
    );
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/v1/spaces/{space_id}', () => {
  it('deletes an existing space', async () => {
    const { validSpaceId, } = spaceFixtures;
    mockPrisma.space.delete.mockResolvedValueOnce({});

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${validSpaceId}`, { method: 'DELETE', }),
      { params: Promise.resolve({ space_id: validSpaceId, }), }
    );
    const body = await response.json() as { message: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe('Space deleted successfully');
  });

  it('returns 409 when space has related records', async () => {
    const { validSpaceId, } = spaceFixtures;
    const error = new Error('Foreign key') as any;
    error.code = 'P2003';
    mockPrisma.space.delete.mockRejectedValueOnce(error);

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${validSpaceId}`, { method: 'DELETE', }),
      { params: Promise.resolve({ space_id: validSpaceId, }), }
    );
    expect(response.status).toBe(409);
  });
});
