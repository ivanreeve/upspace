import type { Prisma } from '@prisma/client';

import type { SpaceStatus } from '@/data/spaces';
import { prisma } from '@/lib/prisma';
import { buildPublicObjectUrl, isAbsoluteUrl, resolveSignedImageUrls } from '@/lib/spaces/image-urls';
import { deriveSpaceStatus } from '@/lib/spaces/partner-serializer';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const formatTime = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
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
      min_capacity: true,
      max_capacity: true,
      price_rate: {
        orderBy: { created_at: 'asc' as const, },
        select: {
          id: true,
          price: true,
          time_unit: true,
        },
      },
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
    },
  },
} satisfies Prisma.spaceInclude;

type MarketplaceSpaceRow = Prisma.spaceGetPayload<{
  include: typeof marketplaceSpaceInclude;
}>;

export type SpaceAreaRate = {
  id: string;
  price: number;
  timeUnit: string;
};

export type SpaceAreaWithRates = {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number | null;
  rates: SpaceAreaRate[];
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
  hostName: string | null;
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
  areas.map((area) => ({
    id: area.id,
    name: area.name,
    minCapacity: Number(area.min_capacity),
    maxCapacity: area.max_capacity === null ? null : Number(area.max_capacity),
    rates: area.price_rate.map((rate) => ({
      id: rate.id,
      price: Number(rate.price),
      timeUnit: rate.time_unit,
    })),
  }));

const buildAmenities = (amenities: MarketplaceSpaceRow['amenity']): SpaceAmenityDisplay[] =>
  amenities
    .map((entry) => {
      if (!entry.amenity_choice) {
        return null;
      }
      return {
        id: entry.amenity_choice.id,
        name: entry.amenity_choice.name,
        category: entry.amenity_choice.category ?? null,
      } satisfies SpaceAmenityDisplay;
    })
    .filter((value): value is SpaceAmenityDisplay => Boolean(value));

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
      verification: { some: { status: { in: ['approved', 'in_review'], }, }, },
    },
    include: marketplaceSpaceInclude,
  });

  if (!space) {
    return null;
  }

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

  return {
    id: space.id,
    name: space.name,
    isBookmarked,
    description: space.description ?? '',
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
    hostName: buildHostName(space.user),
  };
}
