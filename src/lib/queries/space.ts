import type { Prisma } from '@prisma/client';

import type { PriceRuleDefinition, PriceRuleRecord } from '@/lib/pricing-rules';
import type { SpaceStatus } from '@/data/spaces';
import { prisma } from '@/lib/prisma';
import { buildPublicObjectUrl, isAbsoluteUrl, resolveSignedImageUrls } from '@/lib/spaces/image-urls';
import { deriveSpaceStatus } from '@/lib/spaces/partner-serializer';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const formatTime = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${minutes} ${period}`;
};

const marketplaceSpaceInclude = {
  amenity: {
    select: {
      id: true,
      amenity_choice: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
  },
  area: {
    orderBy: { created_at: 'asc' as const, },
    select: {
      id: true,
      name: true,
      max_capacity: true,
      price_rule: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  price_rule: {
    orderBy: { created_at: 'asc' as const, },
    select: {
      id: true,
      name: true,
      description: true,
      definition: true,
      created_at: true,
      updated_at: true,
      _count: { select: { area: true, }, },
    },
  },
  space_availability: {
    orderBy: { day_of_week: 'asc' as const, },
    select: {
      id: true,
      day_of_week: true,
      opening: true,
      closing: true,
    },
  },
  space_image: {
    orderBy: [
      { is_primary: 'desc' as const, },
      { display_order: 'asc' as const, },
      { created_at: 'asc' as const, }
    ],
    select: {
      id: true,
      path: true,
      category: true,
      is_primary: true,
      display_order: true,
    },
  },
  verification: {
    orderBy: { created_at: 'desc' as const, },
    take: 1,
    select: { status: true, },
  },
  user: {
    select: {
      first_name: true,
      last_name: true,
      handle: true,
      avatar: true,
    },
  },
} satisfies Prisma.spaceInclude;

type MarketplaceSpaceRow = Prisma.spaceGetPayload<{
  include: typeof marketplaceSpaceInclude;
}>;

export type SpaceAreaWithRates = {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number | null;
  pricingRuleName: string | null;
  pricingRuleId: string | null;
};

export type SpaceAvailabilityDisplay = {
  id: string;
  dayLabel: string;
  opensAt: string;
  closesAt: string;
};

export type SpaceAmenityDisplay = {
  id: string;
  name: string;
  category: string | null;
};

export type SpaceImageDisplay = {
  id: string;
  url: string;
  category: string | null;
  isPrimary: boolean;
};

export type MarketplaceSpaceDetail = {
  id: string;
  name: string;
  isBookmarked: boolean;
  description: string;
  averageRating: number;
  totalReviews: number;
  unitNumber: string;
  addressSubunit: string;
  street: string;
  barangay: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  status: SpaceStatus;
  lat: number;
  long: number;
  heroImageUrl: string | null;
  galleryImages: SpaceImageDisplay[];
  amenities: SpaceAmenityDisplay[];
  availability: SpaceAvailabilityDisplay[];
  areas: SpaceAreaWithRates[];
  pricingRules: PriceRuleRecord[];
  hostName: string | null;
  hostAvatarUrl: string | null;
};

const buildHostName = (user: MarketplaceSpaceRow['user'] | null) => {
  if (!user) {
    return null;
  }
  const nameParts = [user.first_name, user.last_name].map((part) => part?.trim()).filter(Boolean) as string[];
  if (nameParts.length) {
    return nameParts.join(' ');
  }
  if (user.handle) {
    return user.handle;
  }
  return null;
};

const buildHostAvatarUrl = (user: MarketplaceSpaceRow['user'] | null) => {
  const avatar = user?.avatar?.trim();
  if (!avatar) {
    return null;
  }

  return buildPublicObjectUrl(avatar) ?? avatar;
};

const buildAvailabilityDisplay = (
  slots: MarketplaceSpaceRow['space_availability']
): SpaceAvailabilityDisplay[] =>
  slots.map((slot) => ({
    id: slot.id,
    dayLabel: DAY_LABELS[slot.day_of_week] ?? `Day ${slot.day_of_week + 1}`,
    opensAt: formatTime(slot.opening),
    closesAt: formatTime(slot.closing),
  }));

const buildAreaSummaries = (areas: MarketplaceSpaceRow['area']): SpaceAreaWithRates[] =>
  areas.map((area) => {
    const normalizedMaxCapacity = area.max_capacity === null ? null : Number(area.max_capacity);
    return {
      id: area.id,
      name: area.name,
      minCapacity: normalizedMaxCapacity ?? 0,
      maxCapacity: normalizedMaxCapacity,
      pricingRuleName: area.price_rule?.name ?? null,
      pricingRuleId: area.price_rule?.id ?? null,
    };
  });

const serializeMarketplacePriceRule = (
  rule: MarketplaceSpaceRow['price_rule'][number]
): PriceRuleRecord => ({
  id: rule.id,
  name: rule.name,
  description: rule.description ?? null,
  definition: rule.definition as PriceRuleDefinition,
  linked_area_count: rule._count?.area ?? 0,
  created_at: rule.created_at instanceof Date ? rule.created_at.toISOString() : String(rule.created_at),
  updated_at: rule.updated_at instanceof Date ? rule.updated_at.toISOString() : null,
});

const buildAmenities = (amenities: MarketplaceSpaceRow['amenity']): SpaceAmenityDisplay[] => {
  const result: SpaceAmenityDisplay[] = [];

  for (const entry of amenities) {
    if (!entry.amenity_choice) {
      continue;
    }
    result.push({
      id: entry.amenity_choice.id,
      name: entry.amenity_choice.name,
      category: entry.amenity_choice.category ?? null,
    });
  }

  return result;
};

const buildGallery = async (
  images: MarketplaceSpaceRow['space_image']
): Promise<{ hero: string | null; images: SpaceImageDisplay[] }> => {
  if (!images.length) {
    return {
      hero: null,
      images: [],
    };
  }

  const signedUrlMap = await resolveSignedImageUrls(images);

  const resolvePath = (path: string | null | undefined) => {
    if (!path) {
      return null;
    }
    if (isAbsoluteUrl(path)) {
      return path;
    }
    return signedUrlMap.get(path) ?? buildPublicObjectUrl(path);
  };

  const resolvedImages: SpaceImageDisplay[] = images
    .map((image) => {
      const url = resolvePath(image.path);
      if (!url) {
        return null;
      }
      return {
        id: image.id,
        url,
        category: image.category ?? null,
        isPrimary: Boolean(image.is_primary),
      } satisfies SpaceImageDisplay;
    })
    .filter((value): value is SpaceImageDisplay => Boolean(value));

  const heroImage = resolvedImages.find((image) => image.isPrimary) ?? resolvedImages[0];
  const hero = heroImage?.url ?? null;

  return {
    hero,
    images: resolvedImages,
  };
};

type SpaceDetailOptions = {
  bookmarkUserId?: bigint;
};

export async function getSpaceDetail(
  spaceId: string,
  options: SpaceDetailOptions = {}
): Promise<MarketplaceSpaceDetail | null> {
  const { bookmarkUserId, } = options;

  const space = await prisma.space.findFirst({
    where: {
      id: spaceId,
      is_published: true,
      verification: { some: { status: { in: ['approved', 'in_review'], }, }, },
    },
    include: marketplaceSpaceInclude,
  });

  if (!space) {
    return null;
  }

  const reviewAggregate = await prisma.review.aggregate({
    where: { space_id: spaceId, },
    _avg: { rating_star: true, },
    _count: { _all: true, },
  });

  const averageRating = reviewAggregate._avg.rating_star === null
    ? 0
    : Number(reviewAggregate._avg.rating_star);
  const totalReviews = reviewAggregate._count?._all ?? 0;

  const status = deriveSpaceStatus(space);
  const {
    hero,
    images,
  } = await buildGallery(space.space_image);
  const isBookmarked = bookmarkUserId
    ? Boolean(await prisma.bookmark.findFirst({
      where: {
        user_id: bookmarkUserId,
        space_id: space.id,
      },
      select: { bookmark_id: true, },
    }))
    : false;
  const availability = buildAvailabilityDisplay(space.space_availability);
  const areas = buildAreaSummaries(space.area);
  const amenities = buildAmenities(space.amenity);
  const pricingRules = space.price_rule.map(serializeMarketplacePriceRule);

  return {
    id: space.id,
    name: space.name,
    isBookmarked,
    description: space.description ?? '',
    averageRating,
    totalReviews,
    unitNumber: space.unit_number,
    addressSubunit: space.address_subunit,
    street: space.street,
    barangay: space.barangay ?? null,
    city: space.city,
    region: space.region,
    postalCode: space.postal_code,
    countryCode: space.country_code,
    status,
    lat: typeof space.lat === 'number' ? space.lat : Number(space.lat),
    long: typeof space.long === 'number' ? space.long : Number(space.long),
    heroImageUrl: hero,
    galleryImages: images,
    amenities,
    availability,
    areas,
    pricingRules,
    hostName: buildHostName(space.user),
    hostAvatarUrl: buildHostAvatarUrl(space.user),
  };
}
