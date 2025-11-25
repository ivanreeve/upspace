'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FaStar } from 'react-icons/fa';
import { RiEditBoxLine } from 'react-icons/ri';
import { toast } from 'sonner';

import {
  createSpaceReview,
  fetchCommonReviewTags,
  fetchSpaceReviews,
  type CreateSpaceReviewPayload,
  type ReviewTagOption,
  type SpaceReview
} from '@/lib/api/reviews';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

type ReviewsSectionProps = {
  spaceId: string;
};

function StarRatingSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1" aria-label="Rating" role="radiogroup">
      { [1, 2, 3, 4, 5].map((score) => {
        const isActive = score <= value;
        return (
          <button
            key={ score }
            type="button"
            onClick={ () => onChange(score) }
            className="px-2 py-3"
            aria-label={ `${score} star${score > 1 ? 's' : ''}` }
            role="radio"
            aria-checked={ isActive }
          >
            <FaStar
              className={ `size-5 ${
                isActive ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
              }` }
              aria-hidden="true"
            />
          </button>
        );
      }) }
    </div>
  );
}

function ReviewTagsSelector({
  tags,
  selected,
  onChange,
}: {
  tags: ReviewTagOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggleTag = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((tag) => tag !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" aria-label="Quick review tags">
      { tags.map((tag) => {
        const isActive = selected.includes(tag.value);
        return (
          <button
            key={ tag.value }
            type="button"
            onClick={ () => toggleTag(tag.value) }
            className={ `
              rounded-full border px-3 py-1 text-xs
              ${isActive ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}
            ` }
            aria-pressed={ isActive }
          >
            { tag.label }
          </button>
        );
      }) }
    </div>
  );
}

function ReviewCard({ review, }: { review: SpaceReview }) {
  const createdAt = new Date(review.created_at);
  const formattedDate = createdAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article className="space-y-3 rounded-2xl border p-4 shadow-sm">
      <header className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            { review.reviewer.avatar ? (
              <AvatarImage src={ review.reviewer.avatar } alt={ review.reviewer.name } />
            ) : null }
            <AvatarFallback>
              { review.reviewer.name.charAt(0).toUpperCase() }
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{ review.reviewer.name }</p>
            <p className="text-xs text-muted-foreground">{ formattedDate }</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-foreground">
          <FaStar className="size-4 text-yellow-400" aria-hidden="true" />
          <span className="font-medium">{ review.rating_star.toFixed(1) }</span>
        </div>
      </header>

      <p className="text-sm leading-relaxed text-foreground/80">{ review.description }</p>

      { review.comments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          { review.comments.map((comment) => (
            <Badge key={ comment } variant="outline" className="text-xs">
              { comment.replace(/_/g, ' ') }
            </Badge>
          )) }
        </div>
      ) }
    </article>
  );
}

export default function ReviewsSection({ spaceId, }: ReviewsSectionProps) {
  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['space-reviews', spaceId],
    queryFn: () => fetchSpaceReviews(spaceId),
  });

  const {
    data: reviewTags,
    isLoading: isLoadingReviewTags,
    isError: isReviewTagsError,
  } = useQuery({
    queryKey: ['common-review-tags'],
    queryFn: fetchCommonReviewTags,
  });

  const [rating, setRating] = React.useState<number>(1);
  const [description, setDescription] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = React.useState(false);
  const [selectedRatingFilter, setSelectedRatingFilter] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!reviewTags) return;

    setSelectedTags((current) =>
      current.filter((tag) => reviewTags.some((option) => option.value === tag))
    );
  }, [reviewTags]);

  const createReviewMutation = useMutation({
    mutationFn: (payload: CreateSpaceReviewPayload) => createSpaceReview(spaceId, payload),
    onSuccess: async () => {
      setDescription('');
      setSelectedTags([]);
      setFormError(null);
      setIsDialogOpen(false);
      toast.success('Thanks for sharing your review.');
      await queryClient.invalidateQueries({ queryKey: ['space-reviews', spaceId], });
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Failed to submit review.');
      }
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!rating) {
      setFormError('Please select a rating.');
      return;
    }

    if (!description.trim()) {
      setFormError('Please add a short description of your experience.');
      return;
    }

    createReviewMutation.mutate({
      rating_star: rating,
      description: description.trim(),
      comments: selectedTags,
    });
  };

  const availableTags = reviewTags ?? [];
  const reviews = data?.reviews ?? [];
  const reviewCount = reviews.length;
  const filteredModalReviews =
    selectedRatingFilter === null
      ? reviews
      : reviews.filter((review) => Math.round(review.rating_star) === selectedRatingFilter);
  const hasFilteredReviews = filteredModalReviews.length > 0;
  const canOpenReviewsModal = !isError && (reviewCount >= 3 || (data?.summary?.total_reviews ?? 0) >= 3);
  const handleRatingFilterToggle = (rating: number) => {
    setSelectedRatingFilter((current) => (current === rating ? null : rating));
  };
  const handleReviewsModalChange = (open: boolean) => {
    setIsReviewsModalOpen(open);
    if (!open) {
      setSelectedRatingFilter(null);
    }
  };

  const summary = data?.summary ?? {
    average_rating: 0,
    total_reviews: 0,
    breakdown: [
      {
        rating: 5,
        count: 0,
      },
      {
        rating: 4,
        count: 0,
      },
      {
        rating: 3,
        count: 0,
      },
      {
        rating: 2,
        count: 0,
      },
      {
        rating: 1,
        count: 0,
      }
    ],
  };

  const hasReviews = reviewCount > 0;

  return (
    <section className="space-y-6 border-t pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-lg font-medium text-foreground">
            <FaStar className="size-5 text-yellow-400" aria-hidden="true" />
            <span>
              { summary.total_reviews > 0
                ? summary.average_rating.toFixed(1)
                : 'No reviews yet' }
            </span>
          </div>
          { summary.total_reviews > 0 && (
            <span className="text-sm text-muted-foreground">
              ({ summary.total_reviews } review{ summary.total_reviews === 1 ? '' : 's' })
            </span>
          ) }
        </div>
        <Dialog open={ isDialogOpen } onOpenChange={ setIsDialogOpen }>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              <RiEditBoxLine className="size-4" aria-hidden="true" />
              Write a review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Write a review</DialogTitle>
            <DialogDescription>
              Share your experience to help others decide if this space is right for them.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={ handleSubmit }>
            <div className="mt-4 flex flex-col items-center space-y-3">
              <Label htmlFor="rating-modal">Your rating</Label>
              <StarRatingSelector value={ rating } onChange={ setRating } />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description-modal">Your experience</Label>
                <Textarea
                  id="description-modal"
                  value={ description }
                  onChange={ (event) => setDescription(event.target.value) }
                  placeholder="Share what you liked, what could be improved, or any tips for others."
                  aria-label="Review description"
                />
              </div>

              <div className="space-y-2">
                <Label className="mb-4 block">Quick tags (optional)</Label>
                { isLoadingReviewTags ? (
                  <div className="flex flex-wrap gap-2">
                    { Array.from({ length: 6, }).map((_, index) => (
                      <Skeleton key={ index } className="h-8 w-24 rounded-full" />
                    )) }
                  </div>
                ) : isReviewTagsError ? (
                  <p className="text-sm text-muted-foreground">
                    Quick tags are unavailable right now.
                  </p>
                ) : availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No quick tags available.
                  </p>
                ) : (
                  <ReviewTagsSelector
                    tags={ availableTags }
                    selected={ selectedTags }
                    onChange={ setSelectedTags }
                  />
                ) }
              </div>

              { formError && (
                <p className="text-sm text-destructive" role="alert">
                  { formError }
                </p>
              ) }

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={ createReviewMutation.isPending }
                  aria-label="Submit review"
                >
                  { createReviewMutation.isPending ? 'Submitting...' : 'Submit review' }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Rating breakdown</h3>
          { summary.total_reviews === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ratings yet. Once guests start leaving reviews, you&apos;ll see how scores are
              distributed here.
            </p>
          ) : (
            <div className="space-y-2">
              { summary.breakdown.map((entry) => {
                const widthPercent = summary.total_reviews
                  ? (entry.count / summary.total_reviews) * 100
                  : 0;
                return (
                  <div
                    key={ entry.rating }
                    className="flex items-center gap-2 text-xs text-foreground"
                    aria-label={ `Rating ${ entry.rating } stars` }
                  >
                    <div className="flex items-center gap-1 w-8">
                      <span>{ entry.rating }</span>
                      <FaStar className="size-3 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="relative h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-secondary"
                        style={ { width: `${widthPercent}%`, } }
                      />
                    </div>
                    <span className="w-10 text-right text-muted-foreground">
                      { entry.count }
                    </span>
                  </div>
                );
              }) }
            </div>
          ) }
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground">Guest reviews</h3>
            { canOpenReviewsModal && (
              <Dialog open={ isReviewsModalOpen } onOpenChange={ handleReviewsModalChange }>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" aria-label="See more reviews">
                    See more reviews
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>All reviews</DialogTitle>
                    <DialogDescription>
                      Browse every review for this space and filter by rating.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Filter by rating</p>
                      <div
                        className="flex flex-wrap items-center gap-2"
                        role="group"
                        aria-label="Filter reviews by star rating"
                      >
                        { [5, 4, 3, 2, 1].map((star) => {
                          const isActive = selectedRatingFilter === star;
                          return (
                            <button
                              key={ star }
                              type="button"
                              onClick={ () => handleRatingFilterToggle(star) }
                              className={ `
                                rounded-full border px-3 py-1 text-xs
                                ${
                                  isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-muted-foreground'
                                }
                              ` }
                              aria-pressed={ isActive }
                            >
                              <span className="flex items-center gap-1">
                                { star }
                                <FaStar className="size-3 text-yellow-400" aria-hidden="true" />
                              </span>
                            </button>
                          );
                        }) }
                        <button
                          type="button"
                          onClick={ () => setSelectedRatingFilter(null) }
                          className={ `
                            rounded-full border px-3 py-1 text-xs
                            ${
                              selectedRatingFilter === null
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground'
                            }
                          ` }
                          aria-pressed={ selectedRatingFilter === null }
                        >
                          All reviews
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                      { hasFilteredReviews ? (
                        filteredModalReviews.map((review) => (
                          <ReviewCard key={ review.review_id } review={ review } />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No reviews with this rating yet.
                        </p>
                      ) }
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) }
          </div>

          { isLoading && (
            <div className="space-y-3">
              <div className="space-y-3 rounded-2xl border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          ) }

          { isError && !isLoading && (
            <p className="text-sm text-destructive">
              Failed to load reviews. Please try again.
            </p>
          ) }

          { !isLoading && !isError && !hasReviews && (
            <p className="text-sm text-muted-foreground">
              No reviews yet. Be the first to share your experience at this space.
            </p>
          ) }

          { !isLoading && !isError && hasReviews && (
            <div className="space-y-3">
              { reviews.map((review) => (
                <ReviewCard key={ review.review_id } review={ review } />
              )) }
            </div>
          ) }
        </div>
      </div>
    </section>
  );
}
