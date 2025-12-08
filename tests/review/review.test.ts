import { common_comment } from '@prisma/client';
import { NextRequest } from 'next/server';
import {
beforeEach,
describe,
expect,
it,
vi
} from 'vitest';

import { reviewFixtures } from '../fixtures/review';

type SupabaseAuthUser = { id: string };
type SupabaseAuthResponse = { data: { user: SupabaseAuthUser | null }; error: null };

const mockPrisma = {
  review: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: { findFirst: vi.fn(), },
  space: { findUnique: vi.fn(), },
  common_review: { createMany: vi.fn(), },
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

  const MockNextResponse = {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: {
          ...(init?.headers ?? {}),
          'content-type': 'application/json',
        },
      }),
  };

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

const {
 GET, POST, 
} = await import('@/app/api/v1/spaces/[space_id]/reviews/route');
const { createSupabaseServerClient, } = await import('@/lib/supabase/server');
const mockedSupabaseServerClient = vi.mocked(createSupabaseServerClient);

const defaultTransaction = async (arg: unknown) => {
  if (Array.isArray(arg)) {
    return Promise.all(arg);
  }

  if (typeof arg === 'function') {
    return arg({
      review: mockPrisma.review,
      common_review: mockPrisma.common_review,
    } as never);
  }

  return arg as Promise<unknown>;
};

const setAuthenticatedUser = (authUserId: string | null) => {
  const payload: SupabaseAuthResponse = {
    data: { user: authUserId ? { id: authUserId, } : null, },
    error: null,
  };
  mockSupabaseClient.auth.getUser.mockResolvedValue(payload);
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

beforeEach(() => {
  mockPrisma.review.aggregate.mockReset();
  mockPrisma.review.groupBy.mockReset();
  mockPrisma.review.findMany.mockReset();
  mockPrisma.review.findFirst.mockReset();
  mockPrisma.review.create.mockReset();
  mockPrisma.user.findFirst.mockReset();
  mockPrisma.space.findUnique.mockReset();
  mockPrisma.common_review.createMany.mockReset();
  mockPrisma.$transaction.mockReset();
  mockPrisma.$transaction.mockImplementation(defaultTransaction);
  mockSupabaseClient.auth.getUser.mockReset();
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null, },
    error: null,
  });
  mockedSupabaseServerClient.mockClear();
  vi.clearAllMocks();
});

describe('GET /api/v1/spaces/{space_id}/reviews', () => {
  it('returns summary and reviews using fixtures (honors limit/cursor query params)', async () => {
    const {
 spaceId, list, viewer, 
} = reviewFixtures;

    setAuthenticatedUser(viewer.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: viewer.userId, });
    mockPrisma.review.aggregate.mockResolvedValueOnce(list.aggregate);
    mockPrisma.review.groupBy.mockResolvedValueOnce(list.groupBy);
    mockPrisma.review.findMany.mockResolvedValueOnce(list.reviews);
    mockPrisma.review.findFirst.mockResolvedValueOnce({ id: list.reviews[0].id, });

    const req = createRequest(
      `http://localhost/api/v1/spaces/${spaceId}/reviews?limit=2&cursor=abc`
    );
    const response = await GET(req, { params: Promise.resolve({ space_id: spaceId, }), });
    const body = await response.json() as { data: unknown };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        summary: {
          average_rating: 4.5,
          total_reviews: 2,
          breakdown: [
            {
 rating: 5,
count: 1, 
},
            {
 rating: 4,
count: 1, 
},
            {
 rating: 3,
count: 0, 
},
            {
 rating: 2,
count: 0, 
},
            {
 rating: 1,
count: 0, 
}
          ],
        },
        reviews: [
          {
            review_id: list.reviews[0].id,
            rating_star: 5,
            description: list.reviews[0].description,
            created_at: list.reviews[0].created_at.toISOString(),
            comments: list.reviews[0].common_review.map((entry) => entry.comment),
            reviewer: {
              name: 'Alex Rivera',
              handle: 'alex-r',
              avatar: '/avatars/alex.png',
            },
          },
          {
            review_id: list.reviews[1].id,
            rating_star: 4,
            description: list.reviews[1].description,
            created_at: list.reviews[1].created_at.toISOString(),
            comments: list.reviews[1].common_review.map((entry) => entry.comment),
            reviewer: {
              name: 'remote-guest',
              handle: 'remote-guest',
              avatar: null,
            },
          }
        ],
        viewer_reviewed: true,
      },
    });

    expect(mockPrisma.review.findMany).toHaveBeenCalledWith({
      where: { space_id: spaceId, },
      orderBy: { created_at: 'desc', },
      take: 2,
      select: expect.any(Object),
    });
  });

  it('returns empty summary when no reviews exist', async () => {
    const { spaceId, } = reviewFixtures;

    mockPrisma.review.aggregate.mockResolvedValueOnce({
 _count: 0,
_avg: { rating_star: null, }, 
});
    mockPrisma.review.groupBy.mockResolvedValueOnce([]);
    mockPrisma.review.findMany.mockResolvedValueOnce([]);

    const req = createRequest(`http://localhost/api/v1/spaces/${spaceId}/reviews`);
    const response = await GET(req, { params: Promise.resolve({ space_id: spaceId, }), });
    const body = await response.json() as { data: unknown };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        summary: {
          average_rating: 0,
          total_reviews: 0,
          breakdown: [
            {
 rating: 5,
count: 0, 
},
            {
 rating: 4,
count: 0, 
},
            {
 rating: 3,
count: 0, 
},
            {
 rating: 2,
count: 0, 
},
            {
 rating: 1,
count: 0, 
}
          ],
        },
        reviews: [],
      },
    });
  });

  it('rejects invalid space_id', async () => {
    const { invalidSpaceId, } = reviewFixtures;

    const req = createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/reviews`);
    const response = await GET(req, { params: Promise.resolve({ space_id: invalidSpaceId, }), });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('space_id is required and must be a valid UUID');
    expect(mockPrisma.review.aggregate).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/spaces/{space_id}/reviews', () => {
  it('creates a review and returns the Location header', async () => {
    const {
 spaceId, viewer, createPayload, createdReview, 
} = reviewFixtures;

    setAuthenticatedUser(viewer.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: viewer.userId, });
    mockPrisma.space.findUnique.mockResolvedValueOnce({ id: spaceId, });
    mockPrisma.review.findFirst.mockResolvedValueOnce(null);
    mockPrisma.review.create.mockResolvedValueOnce({
      ...createdReview,
      space_id: spaceId,
    });
    mockPrisma.common_review.createMany.mockResolvedValueOnce({ count: createPayload.comments.length, });

    const req = createRequest(
      `http://localhost/api/v1/spaces/${spaceId}/reviews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }
    );

    const response = await POST(req, { params: Promise.resolve({ space_id: spaceId, }), });
    const body = await response.json() as { data: unknown };

    expect(response.status).toBe(201);
    expect(response.headers.get('Location')).toBe(
      `/api/v1/spaces/${spaceId}/reviews/${createdReview.id}`
    );
    expect(body).toEqual({
      data: {
        review_id: createdReview.id,
        space_id: spaceId,
        user_id: String(viewer.userId),
        rating_star: 5,
        description: createdReview.description,
        created_at: createdReview.created_at.toISOString(),
        comments: createPayload.comments,
      },
    });
    expect(mockPrisma.common_review.createMany).toHaveBeenCalledWith({
      data: createPayload.comments.map((comment) => ({
        review_id: createdReview.id,
        comment,
      })),
    });
  });

  it('prevents duplicate reviews from the same user', async () => {
    const {
 spaceId, viewer, duplicateReview, createPayload, 
} = reviewFixtures;

    setAuthenticatedUser(viewer.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: viewer.userId, });
    mockPrisma.space.findUnique.mockResolvedValueOnce({ id: spaceId, });
    mockPrisma.review.findFirst.mockResolvedValueOnce(duplicateReview);

    const req = createRequest(
      `http://localhost/api/v1/spaces/${spaceId}/reviews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }
    );

    const response = await POST(req, { params: Promise.resolve({ space_id: spaceId, }), });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('You have already reviewed this space.');
    expect(mockPrisma.review.create).not.toHaveBeenCalled();
  });

  it('validates payload and returns 400 on schema errors', async () => {
    const {
 spaceId, viewer, 
} = reviewFixtures;

    setAuthenticatedUser(viewer.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: viewer.userId, });
    mockPrisma.space.findUnique.mockResolvedValueOnce({ id: spaceId, });
    mockPrisma.review.findFirst.mockResolvedValueOnce(null);

    const invalidPayload = {
 rating_star: 6,
description: 'Too high rating', 
};

    const req = createRequest(
      `http://localhost/api/v1/spaces/${spaceId}/reviews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(invalidPayload),
      }
    );

    const response = await POST(req, { params: Promise.resolve({ space_id: spaceId, }), });
    const body = await response.json() as { error: unknown };

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(mockPrisma.review.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const { spaceId, } = reviewFixtures;

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null, },
      error: null,
    });

    const req = createRequest(
      `http://localhost/api/v1/spaces/${spaceId}/reviews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({
          rating_star: 4,
          description: 'No auth user',
          comments: [common_comment.Clean],
        }),
      }
    );

    const response = await POST(req, { params: Promise.resolve({ space_id: spaceId, }), });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required.');
  });

  it('returns 404 when the space is not found', async () => {
    const {
 spaceId, viewer, createPayload, 
} = reviewFixtures;

    setAuthenticatedUser(viewer.authUserId);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: viewer.userId, });
    mockPrisma.space.findUnique.mockResolvedValueOnce(null);

    const req = createRequest(
      `http://localhost/api/v1/spaces/${spaceId}/reviews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }
    );

    const response = await POST(req, { params: Promise.resolve({ space_id: spaceId, }), });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Space not found.');
  });

  it('rejects invalid space_id before hitting prisma', async () => {
    const {
 invalidSpaceId, createPayload, 
} = reviewFixtures;

    const req = createRequest(
      `http://localhost/api/v1/spaces/${invalidSpaceId}/reviews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }
    );

    const response = await POST(req, { params: Promise.resolve({ space_id: invalidSpaceId, }), });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('space_id is required and must be a valid UUID');
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('GET/PATCH/DELETE /api/v1/spaces/{space_id}/reviews/{review_id}', () => {
  it.todo('Add coverage once review detail routes are implemented (GET)');
  it.todo('Add coverage once review update route is implemented (PATCH)');
  it.todo('Add coverage once review deletion route is implemented (DELETE)');
});
