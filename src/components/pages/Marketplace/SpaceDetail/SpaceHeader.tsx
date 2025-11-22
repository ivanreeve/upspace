'use client';

import { useCallback, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { FaBookmark, FaRegBookmark } from 'react-icons/fa';
import { FiBookmark, FiShare2 } from 'react-icons/fi';
import { toast } from 'sonner';

type Rating = { score: number; count: number };

type SpaceHeaderProps = {
  name: string;
  rating: Rating;
  location: string;
  spaceId: string;
  isBookmarked?: boolean;
};

export default function SpaceHeader({
  name,
  rating,
  location,
  spaceId,
  isBookmarked = false,
}: SpaceHeaderProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(isBookmarked);

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
    if (isSaving) {
      return;
    }

    const shouldRemove = isSaved;
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/bookmarks', {
        method: shouldRemove ? 'DELETE' : 'POST',
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

      setIsSaved(!shouldRemove);
      toast.success(shouldRemove ? 'Removed from your bookmarks.' : 'Saved to your bookmarks.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save right now.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isSaved, spaceId]);

  return (
    <header className="space-y-0.5">
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{ name }</h1>
          <p className="text-sm text-muted-foreground">
            * { rating.score.toFixed(1) } - { rating.count } reviews - { location }
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <button
            type="button"
            onClick={ handleShare }
            disabled={ isSharing }
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium cursor-pointer transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
          >
            <FiShare2 className="size-4" aria-hidden="true" />
            { isSharing ? 'Sharing…' : 'Share' }
          </button>
          <button
            type="button"
            onClick={ handleSave }
            disabled={ isSaving }
            aria-busy={ isSaving }
            aria-pressed={ isSaved }
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium cursor-pointer transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
          >
            { isSaving ? (
              <CgSpinner className="size-4 animate-spin" aria-hidden="true" />
            ) : isSaved ? (
              <FaBookmark className="size-4" aria-hidden="true" />
            ) : (
              <FaRegBookmark className="size-4" aria-hidden="true" />
            ) }
            { isSaving ? (isSaved ? 'Removing…' : 'Saving…') : isSaved ? 'Saved' : 'Save' }
          </button>
        </div>
      </div>
    </header>
  );
}
