import Header from './Marketplace.SpaceDetail.Header';
import Gallery from './Marketplace.SpaceDetail.Gallery';
import Host from './Marketplace.SpaceDetail.Host';
import Amenities from './Marketplace.SpaceDetail.Amenities';
import Reviews from './Marketplace.SpaceDetail.Reviews';
import Location from './Marketplace.SpaceDetail.Location';
import Areas from './Marketplace.SpaceDetail.Areas';
import Availability from './Marketplace.SpaceDetail.Availability';

import type { SpaceDetail } from '@/lib/api/space';

const getCountryDisplayName = (() => {
  let formatter: Intl.DisplayNames | null = null;
  return (code?: string | null) => {
    if (!code) return '';
    try {
      if (!formatter) {
        formatter = new Intl.DisplayNames(['en'], { type: 'region' });
      }
      return formatter.of(code) ?? code;
    } catch {
      return code;
    }
  };
})();

export default function MarketplaceSpaceDetail({ space, }: { space: SpaceDetail }) {
  const countryName = getCountryDisplayName(space.country_code);
  const locationParts = [space.city, space.region].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : 'Global City, Taguig';
  const addressDetails = [
    {
      label: 'Street Address',
      value: [space.unit_number, space.street, space.address_subunit].filter(Boolean).join(', '),
    },
    {
      label: 'City / Region',
      value: location,
    },
    {
      label: 'Country',
      value: countryName || space.country_code,
    },
    {
      label: 'Postal Code',
      value: space.postal_code,
    }
  ].filter((detail) => detail.value && detail.value.trim().length > 0);

  const rating = {
    score: 5,
    count: 7,
  };
  const hostName = space.host?.full_name
    || [space.host?.first_name, space.host?.last_name].filter(Boolean).join(' ')
    || 'Space Host';

  const galleryImages = space.images.length > 0 ? space.images : undefined;

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
      rating: 5,
      color: '#4b5563',
    },
    {
      author: 'Shayna',
      date: 'December 2021',
      content:
        'The environment is calm yet energizing, and I have met so many like-minded professionals. The meeting rooms are well-equipped, and the coffee bar is a nice bonus. Definitely...',
      rating: 4,
      color: '#0ea5e9',
    },
    {
      author: 'Luke',
      date: 'December 2021',
      content: 'Fast Wi-Fi and friendly staff -- great for freelancers like me.',
      rating: 4,
      color: '#14b8a6',
    },
    {
      author: 'Josh',
      date: 'November 2021',
      content: 'Well designed and fun space, neighborhood has lots of energy and amenities.',
      rating: 5,
      color: '#111827',
    }
  ];

  const overviewFallback =
    'Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it is the perfect place to stay productive and inspired.';

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-[1440px] space-y-16 px-4 py-12">
        <Header name={ space.name } rating={ rating } location={ location } />

        <Gallery images={ galleryImages } />

        <Host hostName={ hostName } />

        <section className="space-y-6 rounded-3xl border bg-gradient-to-br from-background via-background to-secondary/10 p-8 shadow-md">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overview</p>
            <h2 className="text-2xl text-foreground">About { space.name }</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              { space.overview?.trim() || overviewFallback }
            </p>
          </div>

          { addressDetails.length > 0 && (
            <dl className="grid gap-4 text-sm text-foreground/80 sm:grid-cols-2">
              { addressDetails.map((detail) => (
                <div
                  key={ detail.label }
                  className="rounded-2xl border bg-background/80 px-4 py-3 shadow-sm"
                >
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{ detail.label }</dt>
                  <dd className="mt-1 font-medium text-foreground">{ detail.value }</dd>
                </div>
              )) }
            </dl>
          ) }
        </section>

        <Areas areas={ space.areas ?? [] } />

        <Availability items={ space.availability ?? [] } />

        <Amenities amenities={ space.amenities } />

        <Reviews rating={ rating } highlights={ reviewHighlights } testimonials={ testimonials } />

        <Location city={ space.city } region={ space.region } country={ countryName || space.country_code } />
      </div>
    </main>
  );
}
