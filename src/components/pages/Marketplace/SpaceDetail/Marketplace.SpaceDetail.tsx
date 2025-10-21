import Header from './Marketplace.SpaceDetail.Header';
import Gallery from './Marketplace.SpaceDetail.Gallery';
import Host from './Marketplace.SpaceDetail.Host';
import Amenities from './Marketplace.SpaceDetail.Amenities';
import Reviews from './Marketplace.SpaceDetail.Reviews';
import Location from './Marketplace.SpaceDetail.Location';
import Areas from './Marketplace.SpaceDetail.Areas';
import Availability from './Marketplace.SpaceDetail.Availability';

type Amenity = { amenity_id: bigint; name: string };
type Rate = { rate_id: bigint; time_unit: string; price: any };
type AreaImage = { image_id: bigint; url: string };
type Area = {
  area_id: bigint;
  name: string;
  capacity: bigint;
  image: AreaImage[];
  rate_rate_area_idToarea: Rate[];
};
type AvailabilitySlot = {
  availability_id: bigint;
  day_of_week: string;
  opening_time: Date | string;
  closing_time: Date | string;
};

type Space = {
  space_id: bigint;
  name: string;
  overview?: string | null;
  unit_number: string;
  street: string;
  address_subunit: string;
  city: string;
  region: string;
  country: string;
  postal_code: string;
  amenity: Amenity[];
  area: Area[];
  space_availability: AvailabilitySlot[];
};

export default function MarketplaceSpaceDetail({ space, }: { space: Space }) {
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
value: space.country, 
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

        <Gallery />

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

        <Areas areas={ space.area ?? [] } />

        <Availability items={ space.space_availability ?? [] } />

        <Amenities amenities={ space.amenity } />

        <Reviews rating={ rating } highlights={ reviewHighlights } testimonials={ testimonials } />

        <Location city={ space.city } region={ space.region } country={ space.country } />
      </div>
    </main>
  );
}
