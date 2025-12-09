declare module 'select-philippines-address' {
  export type Region = {
    id: number;
    psgc_code: string;
    region_name: string;
    region_code: string;
  };

export type Province = {
  psgc_code: string;
  province_name: string;
  province_code: string;
  region_code: string;
};

export function regions(): Promise<Region[] | string>;
export function provinces(regionCode?: string): Promise<Province[] | string>;

export type City = {
  city_name: string;
  city_code: string;
  province_code: string;
  region_desc: string;
};

export type Barangay = {
  brgy_name: string;
  brgy_code: string;
  province_code: string;
  region_code: string;
};

export function cities(provinceCode?: string): Promise<City[] | string>;
export function barangays(cityCode?: string): Promise<Barangay[] | string>;
}
