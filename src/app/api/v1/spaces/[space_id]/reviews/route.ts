import { common_comment } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type Params = { params: Promise<{ space_id?: string }> };

const payloadSchema = z.object({
  rating_star: z
    .number()
    .int()
    .min(1, { message: 'Rating must be at least 1 star.', })
    .max(5, { message: 'Rating cannot exceed 5 stars.', }),
  description: z
    .string()
    .trim()
    .min(10, { message: 'Please add a bit more detail to your review.', })
    .max(2000, { message: 'Review is too long (max 2000 characters).', }),
  comments: z
    .array(z.nativeEnum(common_comment))
    .max(10, { message: 'You can select at most 10 quick tags.', })
    .optional(),
});

export async function GET(req: NextRequest, { params, }: Params) {
  const url = new URL(req.url);
  const { searchParams, } = url;
  const { space_id, } = await params;

  if (!isUuid(space_id)) {
    return NextResponse.json(
      { error: 'space_id is required and must be a valid UUID', },
      { status: 400, }
    );
  }

  const limitParam = searchParams.get('limit') ?? undefined;
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
  const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 50;

  const reviews = await prisma.review.findMany({
    where: { space_id, },
    orderBy: { created_at: 'desc', },
    take: safeLimit,
    select: {
      id: true,
      user_id: true,
      rating_star: true,
      description: true,
      created_at: true,
      common_review: { select: { comment: true, }, },
      user: {
        select: {
          first_name: true,
          last_name: true,
          handle: true,
          avatar: true,
        },
      },
    },
  });

  if (!reviews.length) {
    return NextResponse.json({
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
  }

  const totalReviews = reviews.length;
  const totalRating = reviews.reduce((sum, review) => sum + Number(review.rating_star), 0);
  const averageRating = totalRating / totalReviews;

  const ratingCounts: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const review of reviews) {
    const rating = Number(review.rating_star);
    if (ratingCounts[rating] !== undefined) {
      ratingCounts[rating] += 1;
    }
  }

  const resolveReviewerName = (review: (typeof reviews)[number]) => {
    const firstName = review.user?.first_name?.trim();
    const lastName = review.user?.last_name?.trim();
    const handle = review.user?.handle?.trim();

    const nameParts = [firstName, lastName].filter(Boolean) as string[];
    if (nameParts.length) {
      return nameParts.join(' ');
    }
    if (handle) {
      return handle;
    }
    return 'Guest';
  };

  const payload = {
    summary: {
      average_rating: averageRating,
      total_reviews: totalReviews,
      breakdown: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: ratingCounts[rating] ?? 0,
      })),
    },
    reviews: reviews.map((review) => ({
      review_id: review.id,
      rating_star: Number(review.rating_star),
      description: review.description,
      created_at: review.created_at instanceof Date
        ? review.created_at.toISOString()
        : review.created_at,
      comments: review.common_review.map((entry) => entry.comment),
      reviewer: {
        name: resolveReviewerName(review),
        handle: review.user?.handle ?? null,
        avatar: review.user?.avatar ?? null,
      },
    })),
  };

  return NextResponse.json({ data: payload, });
}

export async function POST(req: NextRequest, { params, }: Params) {
  const { space_id, } = await params;

  if (!isUuid(space_id)) {
    return NextResponse.json({ error: 'space_id is required and must be a valid UUID', }, { status: 400, });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: 'Authentication required.', },
      { status: 401, }
    );
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { user_id: true, },
  });

  if (!dbUser) {
    return NextResponse.json(
      { error: 'User profile not found.', },
      { status: 403, }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten(), },
      { status: 400, }
    );
  }

  const space = await prisma.space.findUnique({
    where: { id: space_id, },
    select: { id: true, },
  });

  if (!space) {
    return NextResponse.json(
      { error: 'Space not found.', },
      { status: 404, }
    );
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      space_id,
      user_id: dbUser.user_id,
    },
    select: { id: true, },
  });

  if (existingReview) {
    return NextResponse.json(
      { error: 'You have already reviewed this space.', },
      { status: 409, }
    );
  }

  const uniqueComments = Array.from(
    new Set(parsed.data.comments ?? [])
  ) as common_comment[];

  try {
    const createdReview = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          space_id,
          user_id: dbUser.user_id,
          rating_star: BigInt(parsed.data.rating_star),
          description: parsed.data.description.trim(),
        },
        select: {
          id: true,
          space_id: true,
          user_id: true,
          rating_star: true,
          description: true,
          created_at: true,
        },
      });

      if (uniqueComments.length > 0) {
        await tx.common_review.createMany({
          data: uniqueComments.map((comment) => ({
            review_id: review.id,
            comment,
          })),
        });
      }

      return review;
    });

    const payload = {
      review_id: createdReview.id,
      space_id: createdReview.space_id,
      user_id: createdReview.user_id?.toString() ?? null,
      rating_star: Number(createdReview.rating_star),
      description: createdReview.description,
      created_at: createdReview.created_at instanceof Date
        ? createdReview.created_at.toISOString()
        : createdReview.created_at,
      comments: uniqueComments,
    };

    const res = NextResponse.json(
      { data: payload, },
      { status: 201, }
    );
    res.headers.set(
      'Location',
      `/api/v1/spaces/${space_id}/reviews/${payload.review_id}`
    );
    return res;
  } catch (err) {
    // Fallback for unexpected errors / constraints
    return NextResponse.json(
      { error: 'Failed to create review.', },
      { status: 500, }
    );
  }
}
