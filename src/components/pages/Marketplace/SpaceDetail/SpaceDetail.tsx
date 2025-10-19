import SpaceHeader from './SpaceHeader';
import ImageGallery from './ImageGallery';
import HostInfo from './HostInfo';
import AmenitiesList from './AmenitiesList';
import ReviewsSection from './ReviewsSection';
import WhereYoullBe from './WhereYoullBe';

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
  amenity: { amenity_id: bigint; name: string }[];
};

export default function SpaceDetail({ space, }: { space: Space }) {
  const location = [space.city, space.region].filter(Boolean).join(', ') || 'Global City, Taguig';
  const rating = {
 score: 5.0,
count: 7, 
};
  const hostName = 'Trisha M.';

  const reviewHighlights = [
    {
 label: 'Cleanliness',
value: 5.0, 
},
    {
 label: 'Communication',
value: 5.0, 
},
    {
 label: 'Check-in',
value: 5.0, 
},
    {
 label: 'Accuracy',
value: 5.0, 
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
      color: '#6b7280',
    },
    {
      author: 'Shayna',
      date: 'December 2021',
      content:
        "The environment is calm yet energizing, and I've met so many like-minded professionals. The meeting rooms are well-equipped, and the coffee bar is a nice bonus. Definitely...",
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
      color: '#1f2937',
    }
  ];

  const overviewFallback =
    "Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it's the perfect place to stay productive and inspired.";

  const featureList = [
    {
 name: 'Breakout Spaces',
available: true, 
},
    {
 name: 'Wheelchair Accessible',
available: true, 
},
    {
 name: 'Parking Space(s)',
available: false, 
},
    {
 name: 'Restrooms',
available: true, 
}
  ];

  return (
    <main className="container mx-auto max-w-5xl space-y-12 px-4 py-10">
      <SpaceHeader name={ space.name } rating={ rating } location={ location } />

      <ImageGallery />

      <HostInfo hostName={ hostName } />

      <section className="space-y-4 border-b pb-6">
        <h2 className="text-xl font-medium">About { space.name }</h2>
        <p className="text-sm leading-relaxed text-foreground/80">
          { space.overview?.trim() || overviewFallback }
        </p>
      </section>

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
            eligible for a 50% refund.
          </p>
        </details>
      </section>

      <AmenitiesList amenities={ space.amenity } features={ featureList } />

      <ReviewsSection rating={ rating } highlights={ reviewHighlights } testimonials={ testimonials } />

      <WhereYoullBe city={ space.city } region={ space.region } country={ space.country } />
    </main>
  );
}
