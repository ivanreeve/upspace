'use client'

import { useEffect, useRef, useState } from 'react';

import SpaceHeader from './SpaceHeader';
import SpacePhotos from './SpacePhotos';
import HostInfo from './HostInfo';
import { BookingCard } from './BookingCard';
import AmenitiesList from './AmenitiesList';
import ReviewsSection from './ReviewsSection';
import WhereYoullBe from './WhereYoullBe';
import AreasWithRates from './AreasWithRates';
import AvailabilityTable from './AvailabilityTable';
import SpaceBreadcrumbs from './SpaceBreadcrumbs';

import { SPACE_DESCRIPTION_VIEWER_CLASSNAME } from '@/components/pages/Spaces/space-description-rich-text';
import { Button } from '@/components/ui/button';
import type { MarketplaceSpaceDetail } from '@/lib/queries/space';
import { sanitizeRichText } from '@/lib/rich-text';

const DESCRIPTION_COLLAPSED_HEIGHT = 360; // px

export default function SpaceDetail({ space, }: { space: MarketplaceSpaceDetail }) {
  const locationParts = [space.city, space.region, space.countryCode].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : 'Global City, Taguig';

  const rating = {
    score: space.averageRating,
    count: space.totalReviews,
  };
  const hostName = 'Trisha M.';

  const overviewFallback =
    'Located in the heart of the city, Downtown Space offers a modern and flexible coworking environment designed for entrepreneurs, freelancers, and small teams. With high-speed Wi-Fi, ergonomic workstations, private meeting rooms, and a cozy lounge area, it is the perfect place to stay productive and inspired.';

  const rawAbout = space.description?.trim();
  const aboutSource = rawAbout && rawAbout.length > 0 ? rawAbout : `<p>${overviewFallback}</p>`;
  const aboutHtml = sanitizeRichText(aboutSource);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const descriptionViewportId = `space-description-${space.id}`;

  useEffect(() => {
    const element = descriptionRef.current;
    if (!element) {
      return;
    }

    const updateOverflowState = () => {
      const hasOverflow = element.scrollHeight > DESCRIPTION_COLLAPSED_HEIGHT;
      setIsDescriptionOverflowing(hasOverflow);
    };

    updateOverflowState();

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateOverflowState);
      resizeObserver.observe(element);

      return () => resizeObserver.disconnect();
    }

    return undefined;
  }, [aboutHtml]);

  const shouldClampDescription = !isDescriptionExpanded;
  const shouldShowGradient = shouldClampDescription && isDescriptionOverflowing;

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-[1100px] px-4 py-10 space-y-4">
        <SpaceBreadcrumbs spaceName={ space.name } />

        <SpaceHeader
          name={ space.name }
          rating={ rating }
          location={ location }
          spaceId={ space.id }
          isBookmarked={ space.isBookmarked }
        />

        <SpacePhotos
          spaceName={ space.name }
          heroImageUrl={ space.heroImageUrl }
          galleryImages={ space.galleryImages }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <HostInfo hostName={ space.hostName ?? hostName } avatarUrl={ space.hostAvatarUrl } />

            <section className="space-y-4 border-b pb-6">
              <h2 className="text-xl font-medium text-foreground">About { space.name }</h2>
              <div className="space-y-3">
                <div
                  className={ `
                    relative
                    ${shouldClampDescription ? 'max-h-[360px] overflow-hidden' : ''}
                  ` }
                >
                  <div
                    id={ descriptionViewportId }
                    ref={ descriptionRef }
                    className={ `
                      ${SPACE_DESCRIPTION_VIEWER_CLASSNAME}
                      whitespace-pre-line
                      [&_p]:my-3 [&_p:first-of-type]:mt-0 [&_p:last-of-type]:mb-0
                      [&_ul]:my-3 [&_ol]:my-3 [&_li]:leading-relaxed
                      [&_h1]:mt-5 [&_h2]:mt-4 [&_h3]:mt-3
                    ` }
                    dangerouslySetInnerHTML={ { __html: aboutHtml, } }
                  />
                  { shouldShowGradient ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
                  ) : null }
                </div>
                { isDescriptionOverflowing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-sm font-medium"
                    onClick={ () => setIsDescriptionExpanded((prev) => !prev) }
                    aria-expanded={ isDescriptionExpanded }
                    aria-controls={ descriptionViewportId }
                  >
                    { isDescriptionExpanded ? 'Show less' : 'See full description' }
                  </Button>
                ) : null }
              </div>
            </section>
          </div>

          <BookingCard spaceName={ space.name } />
        </div>

        <AvailabilityTable items={ space.availability } />

        <section className="border-b pb-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <details className="group space-y-2 rounded-lg border p-4">
              <summary className="cursor-pointer text-base font-medium text-foreground">
                Space Rules
              </summary>
              <p className="text-sm text-muted-foreground">
                Keep shared areas tidy, respect quiet hours after 9 PM, and coordinate meeting room
                use with the host. Smoking is not permitted inside the premises.
              </p>
            </details>
            <details className="group space-y-2 rounded-lg border p-4">
              <summary className="cursor-pointer text-base font-medium text-foreground">
                Cancellation Policy
              </summary>
              <p className="text-sm text-muted-foreground">
                Free cancellation up to 7 days before your reservation. Cancellations within 7 days
                are eligible for a 50 percent refund.
              </p>
            </details>
          </div>
        </section>

        <AmenitiesList amenities={ space.amenities } features={ [] } />

        <AreasWithRates areas={ space.areas } />

        <ReviewsSection spaceId={ space.id } />

        <WhereYoullBe city={ space.city } region={ space.region } country={ space.countryCode } />
      </div>
    </main>
  );
}
