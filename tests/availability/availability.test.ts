import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { availabilityFixture } from '../fixtures/availability';

const mockPrisma = {
  space_availability: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
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

const { GET, POST, } = await import('@/app/api/v1/spaces/[space_id]/availability/route');
const { PUT, DELETE, } = await import('@/app/api/v1/spaces/[space_id]/availability/[availability_id]/route');

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const createRequest = (url: string, init?: RequestInit) => {
  const sanitizedInit: NextRequestInit = init
    ? ({ ...init, signal: init.signal ?? undefined } as NextRequestInit)
    : undefined;
  return new NextRequest(url, sanitizedInit);
};

const defaultTransaction = async (fn: any) => {
  if (typeof fn === 'function') {
    return fn(mockPrisma as never);
  }
  return fn;
};

beforeEach(() => {
  Object.values(mockPrisma.space_availability).forEach((fn) => fn.mockReset());
  mockPrisma.$transaction.mockReset();
  mockPrisma.$transaction.mockImplementation(defaultTransaction);
});

describe('GET /api/v1/spaces/{space_id}/availability', () => {
  it('returns availability list sorted', async () => {
    const { spaceId, list, } = availabilityFixture;
    mockPrisma.space_availability.findMany.mockResolvedValueOnce(list);

    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability`),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { data: any[] };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
        availability_id: list[0].id,
        space_id: list[0].space_id,
        day_of_week: 'Monday',
        opening_time: list[0].opening.toISOString(),
        closing_time: list[0].closing.toISOString(),
      },
      {
        availability_id: list[1].id,
        space_id: list[1].space_id,
        day_of_week: 'Tuesday',
        opening_time: list[1].opening.toISOString(),
        closing_time: list[1].closing.toISOString(),
      },
    ]);
  });

  it('returns 400 for invalid space_id', async () => {
    const { invalidSpaceId, } = availabilityFixture;
    const response = await GET(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/availability`),
      { params: Promise.resolve({ space_id: invalidSpaceId, }), }
    );
    expect(response.status).toBe(400);
  });
});

describe('POST /api/v1/spaces/{space_id}/availability', () => {
  it('creates a single slot and sets Location header', async () => {
    const { spaceId, createPayload, createdRows, } = availabilityFixture;
    mockPrisma.$transaction.mockImplementationOnce(async (fn: any) => {
      return fn({
        space_availability: {
          deleteMany: mockPrisma.space_availability.deleteMany,
          create: mockPrisma.space_availability.create.mockResolvedValueOnce(createdRows[0]),
        },
      } as never);
    });

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    const body = await response.json() as { data: any };

    expect(response.status).toBe(201);
    expect(response.headers.get('Location')).toBe(
      `/api/v1/spaces/${spaceId}/availability/${createdRows[0].id}`
    );
    expect(body.data.availability_id).toBe(createdRows[0].id);
  });

  it('validates duplicate days', async () => {
    const { spaceId, createPayloadArray, } = availabilityFixture;
    const dup = [...createPayloadArray, createPayloadArray[0]];

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(dup),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    expect(response.status).toBe(422);
  });

  it('validates time ordering', async () => {
    const { spaceId, } = availabilityFixture;
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({
          day_of_week: 'Monday',
          opening_time: '10:00',
          closing_time: '09:00',
        }),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    expect(response.status).toBe(422);
  });

  it('returns 404 when space not found (P2003)', async () => {
    const { spaceId, createPayload, } = availabilityFixture;
    const err = Object.assign(new Error('fk'), { code: 'P2003', });
    mockPrisma.$transaction.mockImplementationOnce(async () => { throw err; });

    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: spaceId, }), }
    );
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid space_id', async () => {
    const { invalidSpaceId, createPayload, } = availabilityFixture;
    const response = await POST(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/availability`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify(createPayload),
      }),
      { params: Promise.resolve({ space_id: invalidSpaceId, }), }
    );
    expect(response.status).toBe(400);
  });
});

describe('PUT /api/v1/spaces/{space_id}/availability/{availability_id}', () => {
  it('updates a slot', async () => {
    const { spaceId, availabilityId, existingRow, updatedRow, } = availabilityFixture;
    mockPrisma.space_availability.findFirst.mockResolvedValueOnce(existingRow);
    mockPrisma.space_availability.update.mockResolvedValueOnce(updatedRow);

    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability/${availabilityId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({
          opening_time: '10:00',
          closing_time: '19:00',
        }),
      }),
      { params: Promise.resolve({ space_id: spaceId, availability_id: availabilityId, }), }
    );
    const body = await response.json() as { data: any };

    expect(response.status).toBe(200);
    expect(body.data.opening_time).toBe(updatedRow.opening.toISOString());
    expect(body.data.closing_time).toBe(updatedRow.closing.toISOString());
  });

  it('returns 404 when slot is missing', async () => {
    const { spaceId, availabilityId, } = availabilityFixture;
    mockPrisma.space_availability.findFirst.mockResolvedValueOnce(null);

    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability/${availabilityId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ opening_time: '10:00', }),
      }),
      { params: Promise.resolve({ space_id: spaceId, availability_id: availabilityId, }), }
    );
    expect(response.status).toBe(404);
  });

  it('validates time order', async () => {
    const { spaceId, availabilityId, existingRow, } = availabilityFixture;
    mockPrisma.space_availability.findFirst.mockResolvedValueOnce(existingRow);

    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability/${availabilityId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ opening_time: '20:00', closing_time: '19:00', }),
      }),
      { params: Promise.resolve({ space_id: spaceId, availability_id: availabilityId, }), }
    );
    expect(response.status).toBe(422);
  });

  it('returns 400 for invalid ids', async () => {
    const { invalidSpaceId, invalidAvailabilityId, } = availabilityFixture;
    const response = await PUT(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/availability/${invalidAvailabilityId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ opening_time: '10:00', }),
      }),
      { params: Promise.resolve({ space_id: invalidSpaceId, availability_id: invalidAvailabilityId, }), }
    );
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/v1/spaces/{space_id}/availability/{availability_id}', () => {
  it('deletes a slot', async () => {
    const { spaceId, availabilityId, } = availabilityFixture;
    mockPrisma.space_availability.deleteMany.mockResolvedValueOnce({ count: 1, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability/${availabilityId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ space_id: spaceId, availability_id: availabilityId, }), }
    );
    const body = await response.json() as { data: { deleted: boolean } };

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it('returns 404 when slot not found', async () => {
    const { spaceId, availabilityId, } = availabilityFixture;
    mockPrisma.space_availability.deleteMany.mockResolvedValueOnce({ count: 0, });

    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${spaceId}/availability/${availabilityId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ space_id: spaceId, availability_id: availabilityId, }), }
    );
    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid ids', async () => {
    const { invalidSpaceId, invalidAvailabilityId, } = availabilityFixture;
    const response = await DELETE(
      createRequest(`http://localhost/api/v1/spaces/${invalidSpaceId}/availability/${invalidAvailabilityId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ space_id: invalidSpaceId, availability_id: invalidAvailabilityId, }), }
    );
    expect(response.status).toBe(400);
  });
});
