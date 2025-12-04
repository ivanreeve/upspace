export type SpaceReview = {
  review_id: string;
  rating_star: number;
  description: string;
  created_at: string;
  comments: string[];
  reviewer: {
    name: string;
    handle: string | null;
    avatar: string | null;
  };
};

export type SpaceReviewSummary = {
  average_rating: number;
  total_reviews: number;
  breakdown: {
    rating: number;
    count: number;
  }[];
};

export type SpaceReviewsResponse = {
  summary: SpaceReviewSummary;
  reviews: SpaceReview[];
  viewer_reviewed: boolean;
};

export type CreateSpaceReviewPayload = {
  rating_star: number;
  description: string;
  comments?: string[];
};

export type ReviewTagOption = {
  value: string;
  label: string;
};

export async function fetchSpaceReviews(spaceId: string) {
  const response = await fetch(`/api/v1/spaces/${spaceId}/reviews`, {
    headers: { accept: 'application/json', },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch space reviews (${response.status})`);
  }

  const json = await response.json() as { data: SpaceReviewsResponse };
  return json.data;
}

export async function createSpaceReview(spaceId: string, payload: CreateSpaceReviewPayload) {
  const response = await fetch(`/api/v1/spaces/${spaceId}/reviews`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: unknown } | null;
    const message =
      (errorBody && typeof errorBody.error === 'string' && errorBody.error)
      || `Failed to create review (${response.status})`;
    throw new Error(message);
  }

  const json = await response.json();
  return json;
}

export async function fetchCommonReviewTags() {
  const response = await fetch('/api/v1/reviews/tags', {
    headers: { accept: 'application/json', },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch common review tags (${response.status})`);
  }

  const json = await response.json() as { data: ReviewTagOption[] };
  return json.data;
}
