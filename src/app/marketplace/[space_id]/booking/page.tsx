import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { BookingFlow } from '@/components/pages/Booking/booking';
import NavBar from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { getSpaceDetail } from '@/lib/queries/space';

type Props = { params: { space_id: string } };

export async function generateMetadata({ params, }: Props): Promise<Metadata> {
  if (!/^\d+$/.test(params.space_id)) return { title: 'Space Not Found - UpSpace', };

  const space = await getSpaceDetail(BigInt(params.space_id));
  return { title: space ? `Book ${space.name} - UpSpace` : 'Space Not Found - UpSpace', };
}

export default async function MarketplaceSpaceBookingPage({ params, }: Props) {
  if (!/^\d+$/.test(params.space_id)) notFound();

  const spaceId = BigInt(params.space_id);
  const space = await getSpaceDetail(spaceId);
  if (!space) notFound();

  const locationParts = [space.city, space.region, space.country].filter(Boolean);
  const bookingAreas = (space.area ?? []).map((area) => ({
    id: area.area_id.toString(),
    name: area.name,
    capacity: Number(area.capacity),
    heroImage: area.image?.[0]?.url ?? null,
    rates: (area.rate_rate_area_idToarea ?? []).map((rate) => ({
      id: rate.rate_id.toString(),
      timeUnit: rate.time_unit,
      price: normalizePrice(rate.price),
    })),
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
            spaceId={ space.space_id.toString() }
            spaceName={ space.name }
            spaceLocation={ locationParts.join(', ') }
            areaOptions={ bookingAreas }
            availability={ space.space_availability ?? [] }
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
