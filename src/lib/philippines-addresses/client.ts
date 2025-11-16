import {
  barangays,
  cities,
  provinces,
  regions
} from 'select-philippines-address';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type RegionEntry = {
  region_code: string;
  region_name: string;
};

type ProvinceEntry = {
  province_code: string;
  province_name: string;
  region_code: string;
};

type CityEntry = {
  city_code: string;
  city_name: string;
  province_code: string;
};

type BarangayEntry = {
  brgy_code: string;
  brgy_name: string;
};

const isRegionEntry = (entry: unknown): entry is RegionEntry =>
  isRecord(entry) &&
  typeof entry.region_code === 'string' &&
  typeof entry.region_name === 'string';

const isProvinceEntry = (entry: unknown): entry is ProvinceEntry =>
  isRecord(entry) &&
  typeof entry.region_code === 'string' &&
  typeof entry.province_code === 'string' &&
  typeof entry.province_name === 'string';

const isCityEntry = (entry: unknown): entry is CityEntry =>
  isRecord(entry) &&
  typeof entry.city_code === 'string' &&
  typeof entry.city_name === 'string' &&
  typeof entry.province_code === 'string';

const isBarangayEntry = (entry: unknown): entry is BarangayEntry =>
  isRecord(entry) &&
  typeof entry.brgy_code === 'string' &&
  typeof entry.brgy_name === 'string';

const compareByName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export type PhilippineRegionOption = {
  code: string;
  name: string;
};

export type PhilippineCityOption = {
  code: string;
  name: string;
  provinceCode: string;
};

export type PhilippineBarangayOption = {
  code: string;
  name: string;
};

const getProvincesByRegion = async (regionCode: string): Promise<ProvinceEntry[]> => {
  const response = (await provinces(regionCode)) as unknown;

  if (!Array.isArray(response) || !response.every(isProvinceEntry)) {
    throw new Error('Unable to load provinces for the selected region.');
  }

  return response;
};

export const fetchPhilippineRegions = async (): Promise<PhilippineRegionOption[]> => {
  const response = (await regions()) as unknown;

  if (!Array.isArray(response) || !response.every(isRegionEntry)) {
    throw new Error('Unable to load Philippine regions.');
  }

  return response
    .map((region) => ({
      code: region.region_code,
      name: region.region_name,
    }))
    .sort(compareByName);
};

export const fetchPhilippineCitiesByRegion = async (regionCode: string): Promise<PhilippineCityOption[]> => {
  const provinceEntries = await getProvincesByRegion(regionCode);
  const cityOptions: PhilippineCityOption[] = [];

  for (const province of provinceEntries) {
    const response = (await cities(province.province_code)) as unknown;

    if (!Array.isArray(response) || !response.every(isCityEntry)) {
      throw new Error(`Unable to load cities for ${province.province_name}.`);
    }

    cityOptions.push(
      ...response.map((city) => ({
        code: city.city_code,
        name: city.city_name,
        provinceCode: city.province_code,
      }))
    );
  }

  return cityOptions.sort(compareByName);
};

export const fetchPhilippineBarangaysByCity = async (cityCode: string): Promise<PhilippineBarangayOption[]> => {
  const response = (await barangays(cityCode)) as unknown;

  if (!Array.isArray(response) || !response.every(isBarangayEntry)) {
    throw new Error('Unable to load barangays for the selected city.');
  }

  return response
    .map((barangay) => ({
      code: barangay.brgy_code,
      name: barangay.brgy_name,
    }))
    .sort(compareByName);
};
