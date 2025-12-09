import { prisma } from '@/lib/prisma';

export type SearchReferenceData = {
  amenities: string[];
  regions: string[];
  cities: string[];
  barangays: string[];
};

const normalizeStringList = (values: (string | null | undefined)[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));

export const fetchRegions = async () => {
  const rows = await prisma.space.findMany({
    distinct: ['region'],
    orderBy: { region: 'asc', },
    select: { region: true, },
  });

  return normalizeStringList(rows.map((row) => row.region));
};

export const fetchCities = async () => {
  const rows = await prisma.space.findMany({
    distinct: ['city'],
    orderBy: { city: 'asc', },
    select: { city: true, },
  });

  return normalizeStringList(rows.map((row) => row.city));
};

export const fetchBarangays = async () => {
  const rows = await prisma.space.findMany({
    distinct: ['barangay'],
    orderBy: { barangay: 'asc', },
    select: { barangay: true, },
  });

  return normalizeStringList(rows.map((row) => row.barangay));
};

export const fetchAmenityChoices = async () => {
  const rows = await prisma.amenity_choice.findMany({
    orderBy: { name: 'asc', },
    select: { name: true, },
  });

  return normalizeStringList(rows.map((row) => row.name));
};

export async function fetchSearchReferenceData(): Promise<SearchReferenceData> {
  const [amenities, regions, cities, barangays] = await Promise.all([
    fetchAmenityChoices(),
    fetchRegions(),
    fetchCities(),
    fetchBarangays()
  ]);

  return {
    amenities,
    regions,
    cities,
    barangays,
  };
}
