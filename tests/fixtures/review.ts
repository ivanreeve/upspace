import { common_comment } from '@prisma/client';

type ReviewUserFixture = {
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
  avatar: string | null;
};

type ReviewRecordFixture = {
  id: string;
  user_id: bigint | null;
  rating_star: bigint;
  description: string;
  created_at: Date;
  common_review: { comment: common_comment }[];
  user: ReviewUserFixture;
};

type ReviewFixtures = {
  spaceId: string;
  invalidSpaceId: string;
  viewer: {
    authUserId: string;
    userId: bigint;
  };
  list: {
    aggregate: { _count: number; _avg: { rating_star: number | null } };
    groupBy: { rating_star: number; _count: { _all: number } }[];
    reviews: ReviewRecordFixture[];
  };
  createPayload: {
    rating_star: number;
    description: string;
    comments: common_comment[];
  };
  createdReview: ReviewRecordFixture;
  duplicateReview: { id: string };
};

export const reviewFixtures: ReviewFixtures = {
  spaceId: '11111111-1111-4111-8111-111111111111',
  invalidSpaceId: 'space-123',
  viewer: {
    authUserId: 'auth-user-0001',
    userId: BigInt(1001),
  },
  list: {
    aggregate: {
 _count: 2,
_avg: { rating_star: 4.5, }, 
},
    groupBy: [
      {
 rating_star: 5,
_count: { _all: 1, }, 
},
      {
 rating_star: 4,
_count: { _all: 1, }, 
}
    ],
    reviews: [
      {
        id: 'review-1',
        user_id: 'user-0001',
        rating_star: BigInt(5),
        description: 'Loved the bright, quiet work areas.',
        created_at: new Date('2024-11-01T10:00:00.000Z'),
        common_review: [
          { comment: common_comment.Clean, },
          { comment: common_comment.Good_lighting, }
        ],
        user: {
          first_name: 'Alex',
          last_name: 'Rivera',
          handle: 'alex-r',
          avatar: '/avatars/alex.png',
        },
      },
      {
        id: 'review-2',
        user_id: 'user-0002',
        rating_star: BigInt(4),
        description: 'Solid space with reliable internet and helpful staff.',
        created_at: new Date('2024-11-02T14:00:00.000Z'),
        common_review: [
          { comment: common_comment.Reliable_internet, },
          { comment: common_comment.Helpful_staff, }
        ],
        user: {
          first_name: null,
          last_name: null,
          handle: 'remote-guest',
          avatar: null,
        },
      }
    ],
  },
  createPayload: {
    rating_star: 5,
    description: 'Great location with friendly staff and quiet rooms.',
    comments: [
      common_comment.Clean,
      common_comment.Quiet_workspace,
      common_comment.Reliable_internet
    ],
  },
  createdReview: {
    id: 'review-3',
    user_id: BigInt(1001),
    rating_star: BigInt(5),
    description: 'Great location with friendly staff and quiet rooms.',
    created_at: new Date('2024-11-03T09:30:00.000Z'),
    common_review: [
      { comment: common_comment.Clean, },
      { comment: common_comment.Quiet_workspace, },
      { comment: common_comment.Reliable_internet, }
    ],
    user: {
      first_name: 'Alex',
      last_name: 'Rivera',
      handle: 'alex-r',
      avatar: '/avatars/alex.png',
    },
  },
  duplicateReview: { id: 'review-dup', },
};
