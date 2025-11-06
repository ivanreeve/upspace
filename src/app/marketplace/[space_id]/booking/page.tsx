import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { BookingFlow } from '@/components/pages/Booking/booking';
import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { getSpaceDetail } from '@/lib/api/space';

type Props = { params: { space_id: string } };

export async function generateMetadata({ params, }: Props): Promise<Metadata> {
  if (!/^\d+$/.test(params.space_id)) return { title: 'Space Not Found - UpSpace', };

  try {
    const space = await getSpaceDetail(params.space_id);
    return { title: space ? `Book ${space.name} - UpSpace` : 'Space Not Found - UpSpace', };
  } catch {
    return { title: 'Space Not Found - UpSpace', };
  }
}

export default async function MarketplaceSpaceBookingPage({ params, }: Props) {
  if (!/^\d+$/.test(params.space_id)) notFound();

  let space;
  try {
    space = await getSpaceDetail(params.space_id);
  } catch {
    space = null;
  }
  if (!space) notFound();

  const countryName = getCountryDisplayName(space.country_code);
  const locationParts = [space.city, space.region, countryName || space.country_code].filter(Boolean);
  const bookingAreas = (space.areas ?? []).map((area, index) => ({
    id: area.area_id ?? `area-${index}`,
    name: area.name,
    capacity: Number(
      area.max_capacity ??
        area.min_capacity ??
        0
    ),
    minCapacity: area.min_capacity != null ? Number(area.min_capacity) : null,
    maxCapacity: area.max_capacity != null ? Number(area.max_capacity) : null,
    heroImage: area.images?.[0]?.url ?? null,
    rates: (area.price_rates ?? []).map((rate, rateIndex) => ({
      id: rate.rate_id ?? `rate-${index}-${rateIndex}`,
      timeUnit: rate.time_unit ?? '',
      price: normalizePrice(rate.price),
    })),
  }));
  const availability = (space.availability ?? []).map((slot) => ({
    day_of_week: slot.day_index ?? slot.day_label,
    opening: slot.opening,
    closing: slot.closing,
  }));

  return (
    <>
      <NavBar />
      <main className="bg-background">
        <div className="mx-auto flex min-h-[60vh] max-w-[960px] flex-col gap-8 px-4 py-12">
          <header className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Booking
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Reserve { space.name }
            </h1>
            <p className="text-sm text-muted-foreground">
              { locationParts.length > 0 ? locationParts.join(', ') : 'Location unavailable' }
            </p>
          </header>

          <BookingFlow
            spaceId={ (space.space_id ?? params.space_id).toString() }
            spaceName={ space.name }
            spaceLocation={ locationParts.join(', ') }
            areaOptions={ bookingAreas }
            availability={ availability }
          />
        </div>
      </main>
      <Footer />
    </>
  );
}

function normalizePrice(price: any) {
  if (price == null) return '0';
  if (typeof price === 'string') return price;
  if (typeof price === 'number') return price.toString();
  if (typeof price === 'bigint') return price.toString();
  if (typeof (price as { toString?: () => string }).toString === 'function') {
    return (price as { toString: () => string }).toString();
  }
  return '0';
}

const getCountryDisplayName = (() => {
  let formatter: Intl.DisplayNames | null = null;
  return (code?: string | null) => {
    if (!code) return '';
    try {
      if (!formatter) {
        formatter = new Intl.DisplayNames(['en'], { type: 'region', });
      }
      return formatter.of(code) ?? code;
    } catch {
      return code;
    }
  };
})();
