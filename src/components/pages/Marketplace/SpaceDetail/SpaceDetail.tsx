import SpaceHeader from './SpaceHeader';
import SpacePhotos from './SpacePhotos';
import HostInfo from './HostInfo';
import AmenitiesList from './AmenitiesList';
import ReviewsSection from './ReviewsSection';
import WhereYoullBe from './WhereYoullBe';
import AreasWithRates from './AreasWithRates';
import AvailabilityTable from './AvailabilityTable';

import type { MarketplaceSpaceDetail } from '@/lib/queries/space';

export default function SpaceDetail({ space, }: { space: MarketplaceSpaceDetail }) {
  const locationParts = [space.city, space.region, space.countryCode].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : 'Global City, Taguig';

  const rating = {
 score: 5,
count: 7, 
};
  const hostName = 'Trisha M.';

  const reviewHighlights = [
    {
 label: 'Cleanliness',
value: 5, 
},
    {
 label: 'Communication',
value: 5, 
},
    {
 label: 'Check-in',
value: 5, 
},
    {
 label: 'Accuracy',
value: 5, 
},
    {
 label: 'Location',
value: 4.9, 
},
    {
 label: 'Value',
value: 4.7, 
}
  ];

  const testimonials = [
    {
      author: 'Jose',
      date: 'December 2021',
      content: 'Clean, modern, and super convenient. Love the atmosphere here!',
      color: '#4b5563',
    },
    {
      author: 'Shayna',
      date: 'December 2021',
      content:
        'The environment is calm yet energizing, and I have met so many like-minded professionals. The meeting rooms are well-equipped, and the coffee bar is a nice bonus. Definitely...',
      color: '#0ea5e9',
    },
    {
      author: 'Luke',
      date: 'December 2021',
      content: 'Fast Wi-Fi and friendly staff -- great for freelancers like me.',
      color: '#14b8a6',
    },
    {
      author: 'Josh',
      date: 'November 2021',
      content: 'Well designed and fun space, neighborhood has lots of energy and amenities.',
      color: '#111827',
    }
  ];

  const overviewFallback =
    'Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it is the perfect place to stay productive and inspired.';

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-[1100px] px-4 py-10 space-y-12">
        <SpaceHeader
          name={ space.name }
          rating={ rating }
          location={ location }
          spaceId={ space.id }
        />

        <SpacePhotos
          spaceName={ space.name }
          heroImageUrl={ space.heroImageUrl }
          galleryImageUrls={ space.galleryImageUrls }
        />

        <HostInfo hostName={ space.hostName ?? hostName } />

        <section className="space-y-4 border-b pb-6">
          <h2 className="text-xl font-medium text-foreground">About { space.name }</h2>
          <p className="text-sm leading-relaxed text-foreground/80">
            { space.description?.trim() || overviewFallback }
          </p>
        </section>

        <AreasWithRates areas={ space.areas } />

        <AvailabilityTable items={ space.availability } />

        <section className="space-y-4 border-b pb-6">
          <details className="group space-y-2 rounded-lg border p-4">
            <summary className="cursor-pointer text-base font-medium text-foreground">
              Host Rules
            </summary>
            <p className="text-sm text-muted-foreground">
              Keep shared areas tidy, respect quiet hours after 9 PM, and coordinate meeting room use
              with the host. Smoking is not permitted inside the premises.
            </p>
          </details>
          <details className="group space-y-2 rounded-lg border p-4">
            <summary className="cursor-pointer text-base font-medium text-foreground">
              Cancellation Policy
            </summary>
            <p className="text-sm text-muted-foreground">
              Free cancellation up to 7 days before your reservation. Cancellations within 7 days are
              eligible for a 50 percent refund.
            </p>
          </details>
        </section>

        <AmenitiesList amenities={ space.amenities } features={ [] } />

        <ReviewsSection rating={ rating } highlights={ reviewHighlights } testimonials={ testimonials } />

        <WhereYoullBe city={ space.city } region={ space.region } country={ space.countryCode } />
      </div>
    </main>
  );
}
