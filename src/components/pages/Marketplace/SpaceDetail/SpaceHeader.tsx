'use client';

import {
useCallback,
useEffect,
useMemo,
useState
} from 'react';
import type { IconType } from 'react-icons';
import { CgSpinner } from 'react-icons/cg';
import {
  FaFacebook,
  FaFacebookMessenger,
  FaInstagram,
  FaHeart,
  FaRegHeart,
  FaTelegramPlane
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { FiLink, FiShare2 } from 'react-icons/fi';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/auth/SessionProvider';

type SpaceHeaderProps = {
  name: string;
  location: string;
  spaceId: string;
  isBookmarked?: boolean;
};

type ShareOption = {
  label: string;
  href: string;
  icon: IconType;
};

export default function SpaceHeader({
  name,
  location,
  spaceId,
  isBookmarked = false,
}: SpaceHeaderProps) {
  const { session, } = useSession();
  const isGuest = !session;

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(isBookmarked);
  const [isCopying, setIsCopying] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href);
    }
  }, []);

  const shareMessage = useMemo(() => `Check out ${name} on UpSpace.`, [name]);

  const shareOptions = useMemo<ShareOption[]>(() => {
    if (!shareUrl) {
      return [];
    }

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedMessage = encodeURIComponent(shareMessage);
    const encodedMessageWithUrl = encodeURIComponent(`${shareMessage} ${shareUrl}`);
    const messengerAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const messengerShareUrl = messengerAppId
      ? `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=${encodeURIComponent(messengerAppId)}&redirect_uri=${encodedUrl}`
      : `https://www.messenger.com/t?link=${encodedUrl}&text=${encodedMessage}`;

    return [
      {
 label: 'Messenger',
href: messengerShareUrl,
icon: FaFacebookMessenger, 
},
      {
 label: 'Facebook',
href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
icon: FaFacebook, 
},
      {
 label: 'X.com',
href: `https://x.com/intent/post?text=${encodedMessageWithUrl}`,
icon: FaXTwitter, 
},
      {
        label: 'Instagram',
        href: `https://www.instagram.com/direct/new/?text=${encodedMessageWithUrl}`,
        icon: FaInstagram,
      },
      {
 label: 'Telegram',
href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`,
icon: FaTelegramPlane, 
}
    ];
  }, [shareMessage, shareUrl]);

  const openShareLink = useCallback(
    (href: string) => {
      if (!shareUrl) {
        toast.error('Unable to share right now. Please try again.');
        return;
      }

      const shareWindow = window.open(href, '_blank', 'noopener,noreferrer');

      if (shareWindow === null) {
        toast.error('Please allow pop-ups to share this space.');
      }
    },
    [shareUrl]
  );

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) {
      toast.error('Unable to copy link right now.');
      return;
    }

    if (!navigator.clipboard) {
      toast.error('Clipboard is not supported in this browser.');
      return;
    }

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to copy link right now.');
    } finally {
      setIsCopying(false);
    }
  }, [shareUrl]);

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
          <p className="text-sm text-muted-foreground">{ location }</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-haspopup="dialog"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium cursor-pointer transition hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
              >
                <FiShare2 className="size-4" aria-hidden="true" />
                Share
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share this space</DialogTitle>
                <DialogDescription className="mb-4">
                  Send { name } to your favorite apps or copy the link below.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                { shareOptions.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    { shareOptions.map((option) => (
                      <Button
                        key={ option.label }
                        type="button"
                        variant="outline"
                        className="justify-start hover:!text-white hover:[&_svg]:!text-white"
                        onClick={ () => openShareLink(option.href) }
                        disabled={ !shareUrl }
                        aria-label={ `Share on ${option.label}` }
                      >
                        <option.icon className="size-4" aria-hidden="true" />
                        { option.label }
                      </Button>
                    )) }
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Preparing share options…</p>
                ) }

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Copy link</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="share-link-input"
                      type="text"
                      value={ shareUrl }
                      readOnly
                      aria-label="Share link"
                      className="sm:flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={ handleCopyLink }
                      disabled={ !shareUrl || isCopying }
                      aria-busy={ isCopying }
                      className="sm:w-auto hover:!text-white hover:[&_svg]:!text-white"
                    >
                      { isCopying ? (
                        <>
                          <CgSpinner className="size-4 animate-spin" aria-hidden="true" />
                          Copying…
                        </>
                      ) : (
                        <>
                          <FiLink className="size-4" aria-hidden="true" />
                          Copy link
                        </>
                      ) }
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          { !isGuest && (
            <button
              type="button"
            onClick={ handleSave }
            disabled={ isSaving }
            aria-busy={ isSaving }
            aria-pressed={ isSaved }
            className={ cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed',
              isSaved
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'border-border hover:bg-accent hover:text-white hover:[&_svg]:text-white'
            ) }
          >
            { isSaving ? (
              <CgSpinner className="size-4 animate-spin" aria-hidden="true" />
            ) : isSaved ? (
              <FaHeart className="size-4 text-rose-600 fill-rose-600" aria-hidden="true" />
            ) : (
              <FaRegHeart className="size-4" aria-hidden="true" />
            ) }
            { isSaving ? (isSaved ? 'Removing…' : 'Saving…') : isSaved ? 'Saved' : 'Save' }
          </button>
          ) }
        </div>
      </div>
    </header>
  );
}
