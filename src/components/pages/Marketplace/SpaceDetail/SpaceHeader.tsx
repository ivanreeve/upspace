'use client';

import { useCallback, useState } from 'react';
import { FiBookmark, FiLoader, FiShare2 } from 'react-icons/fi';
import { toast } from 'sonner';

type Rating = { score: number; count: number };

type SpaceHeaderProps = {
  name: string;
  rating: Rating;
  location: string;
  spaceId: string;
};

export default function SpaceHeader({
  name,
  rating,
  location,
  spaceId,
}: SpaceHeaderProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleShare = useCallback(async () => {
    if (isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      const currentUrl =
        typeof window !== 'undefined' ? window.location.href : '';

      if (!currentUrl) {
        throw new Error('Unable to determine the current URL.');
      }

      const sharePayload = {
        title: `${name} · UpSpace`,
        text: `Take a look at ${name} on UpSpace.`,
        url: currentUrl,
      };

      if (navigator.share) {
        await navigator.share(sharePayload);
        toast.success('Shared the space link.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
        toast.success('Link copied to clipboard.');
      } else {
        throw new Error('Sharing is not supported in this browser.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to share right now.');
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, name]);

  const handleSave = useCallback(async () => {
    if (isSaving || isSaved) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
        body: JSON.stringify({ space_id: spaceId, }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ??
            data?.message ??
            'Unable to save the space. Please try again.'
        );
      }

      setIsSaved(true);
      toast.success('Saved to your bookmarks.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save right now.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isSaved, spaceId]);

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{ name }</h1>
          <p className="text-sm text-muted-foreground">
            * { rating.score.toFixed(1) } - { rating.count } reviews - { location }
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-foreground">
          <button
            type="button"
            onClick={ handleShare }
            disabled={ isSharing }
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
          >
            <FiShare2 className="size-4" aria-hidden="true" />
            { isSharing ? 'Sharing…' : 'Share' }
          </button>
          <button
            type="button"
            onClick={ handleSave }
            disabled={ isSaving || isSaved }
            aria-busy={ isSaving }
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
          >
            { isSaving ? (
              <FiLoader className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FiBookmark className="size-4" aria-hidden="true" />
            ) }
            { isSaved ? 'Saved' : isSaving ? 'Saving…' : 'Save' }
          </button>
        </div>
      </div>
    </header>
  );
}
