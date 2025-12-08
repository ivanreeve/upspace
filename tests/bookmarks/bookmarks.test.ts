import { NextRequest } from 'next/server';
import {
beforeEach,
describe,
expect,
it,
vi
} from 'vitest';

import { bookmarksFixture } from '../fixtures/bookmarks';

type SupabaseAuthUser = { id: string };
type SupabaseAuthResponse = { data: { user: SupabaseAuthUser | null }; error: null };

const mockPrisma = {
  user: { findFirst: vi.fn(), },
  space: { findUnique: vi.fn(), },
  bookmark: {
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
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

const {
 POST, DELETE, 
} = await import('@/app/api/v1/bookmarks/route');
const { createSupabaseServerClient, } = await import('@/lib/supabase/server');
const mockedSupabaseServerClient = vi.mocked(createSupabaseServerClient);

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
  Object.values(mockPrisma).forEach((model) => {
    Object.values(model).forEach((fn) => (fn as any).mockReset?.());
  });
  mockSupabaseClient.auth.getUser.mockReset();
  mockedSupabaseServerClient.mockClear();
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null, },
    error: null,
  });
});

describe('POST /api/v1/bookmarks', () => {
  it('creates a bookmark', async () => {
    const {
 authUserId, userId, spaceId, 
} = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: { id: authUserId, }, },
error: null, 
});
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: userId, });
    mockPrisma.space.findUnique.mockResolvedValueOnce({ id: spaceId, });
    mockPrisma.bookmark.findFirst.mockResolvedValueOnce(null);
    mockPrisma.bookmark.create.mockResolvedValueOnce({});

    const response = await POST(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      })
    );
    const body = await response.json() as { message: string };

    expect(response.status).toBe(201);
    expect(body.message).toBe('Bookmark saved.');
    expect(mockPrisma.bookmark.create).toHaveBeenCalledWith({
      data: {
        user_id: userId,
        space_id: spaceId,
        created_at: expect.any(Date),
      },
    });
  });

  it('returns 200 when already bookmarked', async () => {
    const {
 authUserId, userId, spaceId, 
} = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: { id: authUserId, }, },
error: null, 
});
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: userId, });
    mockPrisma.space.findUnique.mockResolvedValueOnce({ id: spaceId, });
    mockPrisma.bookmark.findFirst.mockResolvedValueOnce({ id: 'existing', });

    const response = await POST(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      })
    );
    const body = await response.json() as { message: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe('Already bookmarked.');
    expect(mockPrisma.bookmark.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const { spaceId, } = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: null, },
error: null, 
});

    const response = await POST(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      })
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required.');
  });

  it('returns 404 when space not found', async () => {
    const {
 authUserId, userId, spaceId, 
} = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: { id: authUserId, }, },
error: null, 
});
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: userId, });
    mockPrisma.space.findUnique.mockResolvedValueOnce(null);

    const response = await POST(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      })
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Space not found.');
  });

  it('returns 400 for invalid space id', async () => {
    const {
 authUserId, userId, 
} = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: { id: authUserId, }, },
 error: null, 
});
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: userId, });
    mockPrisma.bookmark.create.mockImplementation(() => {
      throw new Error('bookmark.create should not be called on invalid space id');
    });

    const response = await POST(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: 'not-a-uuid', }),
      })
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.bookmark.create).not.toHaveBeenCalled();
  });

  it('returns 404 when user record is missing', async () => {
    const {
 authUserId, spaceId, 
} = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: authUserId, }, },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const response = await POST(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      })
    );
    expect(response.status).toBe(403);
    expect(mockPrisma.bookmark.create).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/bookmarks', () => {
  it('deletes a bookmark', async () => {
    const {
 authUserId, userId, spaceId, 
} = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: { id: authUserId, }, },
error: null, 
});
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: userId, });

    mockPrisma.bookmark.deleteMany.mockResolvedValueOnce({ count: 1, });

    const response = await DELETE(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      })
    );
    const body = await response.json() as { message: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe('Bookmark removed.');
    expect(mockPrisma.bookmark.deleteMany).toHaveBeenCalledWith({
      where: {
        user_id: userId,
        space_id: spaceId,
      },
    });
  });

  it('requires authentication', async () => {
    const { spaceId, } = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: null, },
error: null, 
});

    const response = await DELETE(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid space id', async () => {
    const {
 authUserId, userId, 
} = bookmarksFixture;
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
 data: { user: { id: authUserId, }, },
 error: null, 
});
    mockPrisma.user.findFirst.mockResolvedValueOnce({ user_id: userId, });
    mockPrisma.bookmark.deleteMany.mockImplementation(() => {
      throw new Error('bookmark.deleteMany should not be called on invalid space id');
    });

    const response = await DELETE(
      createRequest('http://localhost/api/v1/bookmarks', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: 'bad', }),
      })
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.bookmark.deleteMany).not.toHaveBeenCalled();
  });
});
