'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

import { SPACE_DESCRIPTION_VIEWER_CLASSNAME } from '@/components/pages/Spaces/space-description-rich-text';
import { cn } from '@/lib/utils';

const DESCRIPTION_COLLAPSED_HEIGHT = 360; // px

type SpaceDescriptionSectionProps = {
  spaceId: string;
  spaceName: string;
  aboutText: string;
};

export default function SpaceDescriptionSection({
  spaceId,
  spaceName,
  aboutText,
}: SpaceDescriptionSectionProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] =
    useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);
  const descriptionViewportId = `space-description-${spaceId}`;

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
  }, [aboutText]);

  useEffect(() => {
    if (!isDescriptionExpanded || !isDescriptionOverflowing) {
      setShowScrollToBottom(false);
      return undefined;
    }

    const handleScroll = () => {
      const section = descriptionSectionRef.current;
      if (!section) {
        return;
      }

      const sectionRect = section.getBoundingClientRect();
      const sectionBottom = sectionRect.bottom;
      const viewportHeight = window.innerHeight;

      const isNotAtBottom = sectionBottom > viewportHeight + 100;
      setShowScrollToBottom(isNotAtBottom);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true, });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDescriptionExpanded, isDescriptionOverflowing]);

  const scrollToBottomOfDescription = useCallback(() => {
    const section = descriptionSectionRef.current;
    if (!section) {
      return;
    }

    const sectionRect = section.getBoundingClientRect();
    const absoluteTop = window.pageYOffset + sectionRect.top;
    const sectionHeight = sectionRect.height;

    window.scrollTo({
      top: absoluteTop + sectionHeight - window.innerHeight + 100,
      behavior: 'smooth',
    });
  }, []);

  const shouldClampDescription = !isDescriptionExpanded;
  const shouldShowGradient = shouldClampDescription && isDescriptionOverflowing;

  return (
    <section ref={ descriptionSectionRef } className="space-y-4 border-b pb-6">
      <h2 className="text-xl font-medium text-foreground">About { spaceName }</h2>
      <div className="relative">
        <div
          className={ cn(
            'relative',
            shouldClampDescription && 'max-h-[360px] overflow-hidden'
          ) }
        >
          <div
            id={ descriptionViewportId }
            ref={ descriptionRef }
            className={ cn(
              SPACE_DESCRIPTION_VIEWER_CLASSNAME,
              'whitespace-pre-line',
              '[&_p]:my-3 [&_p:first-of-type]:mt-0 [&_p:last-of-type]:mb-0',
              '[&_ul]:my-3 [&_ol]:my-3 [&_li]:leading-relaxed',
              '[&_h1]:mt-5 [&_h2]:mt-4 [&_h3]:mt-3'
            ) }
          >
            <div dangerouslySetInnerHTML={ { __html: aboutText, } } />
          </div>
          { shouldShowGradient ? (
            <div className="absolute inset-x-0 bottom-0 h-32">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 flex justify-center">
                <button
                  type="button"
                  onClick={ () => setIsDescriptionExpanded(true) }
                  aria-expanded={ false }
                  aria-controls={ descriptionViewportId }
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-white"
                >
                  Show more
                  <FiChevronDown className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null }
        </div>

        { isDescriptionOverflowing && isDescriptionExpanded ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={ () => setIsDescriptionExpanded(false) }
              aria-expanded={ true }
              aria-controls={ descriptionViewportId }
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-white"
            >
              Show less
              <FiChevronUp className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null }

        { showScrollToBottom ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
            <button
              type="button"
              onClick={ scrollToBottomOfDescription }
              aria-label="Scroll to bottom of description"
              className="flex items-center justify-center rounded-full border border-border bg-background p-3 text-foreground shadow-lg transition-all hover:scale-110 hover:bg-accent hover:text-white"
            >
              <FiChevronDown className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : null }
      </div>
    </section>
  );
}
