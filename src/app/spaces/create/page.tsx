'use client';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type FieldPathValues } from 'react-hook-form';
import {
  FiArrowLeft,
  FiArrowRight,
  FiPlus,
  FiTrash,
  FiX
} from 'react-icons/fi';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { MdOutlineMailOutline } from 'react-icons/md';

import {
  SpaceAddressFields,
  SpaceDetailsFields,
  SpaceFormValues,
  createSpaceFormDefaults,
  spaceSchema
} from '@/components/pages/Spaces/SpaceForms';
import { SpaceAmenitiesStep } from '@/components/pages/Spaces/SpaceAmenitiesStep';
import { SpaceVerificationRequirementsStep, VERIFICATION_REQUIREMENTS, type VerificationRequirementId } from '@/components/pages/Spaces/SpaceVerificationRequirementsStep';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { type AgreementChecklistItem } from '@/components/ui/AgreementChecklist';
import { Form } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { richTextPlainTextLength } from '@/lib/rich-text';
import NavBar from '@/components/ui/navbar';
import { useSpacesStore } from '@/stores/useSpacesStore';
import { useSpaceFormPersistence } from '@/hooks/useSpaceFormPersistence';
import { usePersistentSpaceImages } from '@/hooks/usePersistentSpaceImages';

const MAX_CATEGORY_IMAGES = 5;
const CATEGORY_NAME_SAMPLES = [
  'Lounge & reception',
  'Dedicated desks',
  'Meeting rooms',
  'Cafe & pantry',
  'Outdoor or rooftop'
] as const;
const getSampleCategoryName = (index: number) => CATEGORY_NAME_SAMPLES[index % CATEGORY_NAME_SAMPLES.length];
const generateCategoryId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `category-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const WATCHED_FIELD_NAMES = ['name', 'description', 'street', 'city', 'region', 'postal_code', 'country_code'] as const;
type WatchedFieldNames = typeof WATCHED_FIELD_NAMES;
type WatchedFieldValues = FieldPathValues<SpaceFormValues, WatchedFieldNames>;
type SpaceFormStep = 1 | 2 | 3 | 4 | 5;
const STEP_SEQUENCE: SpaceFormStep[] = [1, 2, 3, 4, 5];
type VerificationRequirementsState = Record<VerificationRequirementId, File | null>;

const createEmptyVerificationRequirementsState = (): VerificationRequirementsState =>
  VERIFICATION_REQUIREMENTS.reduce((state, requirement) => {
    state[requirement.id] = null;
    return state;
  }, {} as VerificationRequirementsState);

const spaceListingChecklist: AgreementChecklistItem[] = [
  {
    id: 'listing-terms-accept',
    content: (
      <>
        I confirm this workspace submission is governed by the { ' ' }
        <Link
          href="/terms"
          className="font-semibold text-secondary underline-offset-2 hover:underline"
        >
          Terms &amp; Conditions
        </Link>
        .
      </>
    ),
  }
];

const createListingChecklistState = () =>
  spaceListingChecklist.reduce((state, item) => {
    state[item.id] = false;
    return state;
  }, {} as Record<string, boolean>);

export default function SpaceCreateRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const stepParam = searchParams.get('step');
  const currentStep: SpaceFormStep =
    stepParam === '2'
      ? 2
      : stepParam === '3'
        ? 3
        : stepParam === '4'
          ? 4
          : stepParam === '5'
            ? 5
            : 1;
  const createSpace = useSpacesStore((state) => state.createSpace);
  const form = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: createSpaceFormDefaults(),
  });
  const {
    clearDraft,
    isHydrated: isFormHydrated,
  } = useSpaceFormPersistence(form);

  const [listingChecklistState, setListingChecklistState] = useState<Record<string, boolean>>(createListingChecklistState);
  const isListingChecklistComplete = useMemo(
    () => Object.values(listingChecklistState).every(Boolean),
    [listingChecklistState]
  );

  const watchedDefaults = useMemo(
    () =>
      WATCHED_FIELD_NAMES.map((fieldName) => form.getValues(fieldName)) as WatchedFieldValues,
    [form]
  );

  const watchedArray = useWatch<SpaceFormValues, WatchedFieldNames>({
    control: form.control,
    name: WATCHED_FIELD_NAMES,
    defaultValue: watchedDefaults,
  });

  const [
    nameValue = '',
    descriptionValue = '',
    streetValue = '',
    cityValue = '',
    regionValue = '',
    postalCodeValue = '',
    countryCodeValue = ''
  ] = watchedArray;

  const selectedAmenities = useWatch<SpaceFormValues, 'amenities'>({
    control: form.control,
    name: 'amenities',
    defaultValue: form.getValues('amenities'),
  }) ?? [];

  const normalize = (value?: string) => (value ?? '').trim();

  const {
    featuredImage,
    setFeaturedImage,
    categories: photoCategories,
    setCategories: setPhotoCategories,
    clearImages,
    isHydrated: areImagesHydrated,
  } = usePersistentSpaceImages();
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);
  const [categoryPreviews, setCategoryPreviews] = useState<Record<string, string[]>>({});
  const featuredImageInputRef = useRef<HTMLInputElement | null>(null);
  const categoryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [verificationRequirements, setVerificationRequirements] = useState<VerificationRequirementsState>(() =>
    createEmptyVerificationRequirementsState()
  );
  const isPersistenceHydrated = isFormHydrated && areImagesHydrated;

  const handleRequirementUpload = (requirementId: VerificationRequirementId, file: File) => {
    setVerificationRequirements((prev) => ({
      ...prev,
      [requirementId]: file,
    }));
  };

  const handleRequirementRemove = (requirementId: VerificationRequirementId) => {
    setVerificationRequirements((prev) => ({
      ...prev,
      [requirementId]: null,
    }));
  };

  const resetVerificationRequirements = useCallback(() => {
    setVerificationRequirements(createEmptyVerificationRequirementsState());
  }, []);

  const isBasicsStepComplete =
    normalize(nameValue).length > 0 &&
    richTextPlainTextLength(descriptionValue ?? '') >= 20;

  const isPhotoStepComplete =
    Boolean(featuredImage) &&
    photoCategories.length > 0 &&
    photoCategories.every((category) => normalize(category.name).length > 0);

  const isAmenitiesStepComplete = selectedAmenities.length >= 2;

  const isAddressStepComplete =
    normalize(streetValue).length > 0 &&
    normalize(cityValue).length > 0 &&
    normalize(regionValue).length > 0 &&
    normalize(postalCodeValue).length === 4 &&
    normalize(countryCodeValue).length === 2;

  const isRequirementsStepComplete = VERIFICATION_REQUIREMENTS.every((requirement) =>
    Boolean(verificationRequirements[requirement.id])
  );

  useEffect(() => {
    if (!areImagesHydrated) {
      return;
    }

    if (photoCategories.length === 0) {
      setPhotoCategories([
        {
          id: generateCategoryId(),
          name: getSampleCategoryName(0),
          images: [],
        }
      ]);
    }
  }, [areImagesHydrated, photoCategories, setPhotoCategories]);

  const navigateToStep = useCallback(
    (nextStep: SpaceFormStep, options?: { replace?: boolean; }) => {
      const params = new URLSearchParams(serializedSearchParams);
      params.set('step', String(nextStep));
      const query = params.toString();
      const target = query ? `/spaces/create?${query}` : '/spaces/create';

      if (options?.replace) {
        router.replace(target);
      } else {
        router.push(target);
      }
    },
    [router, serializedSearchParams]
  );

  const goToPhotoStep = async () => {
    const canProceed = await form.trigger(['name', 'description']);

    if (!canProceed) {
      return;
    }

    navigateToStep(2);
  };

  const goToAmenitiesStep = () => {
    if (!featuredImage) {
      toast.error('Upload a featured image before continuing.');
      return;
    }

    if (photoCategories.length === 0) {
      toast.error('Add at least one photo category.');
      return;
    }

    if (photoCategories.some((category) => normalize(category.name).length === 0)) {
      toast.error('Give each photo category a heading.');
      return;
    }

    navigateToStep(3);
  };

  const goToAddressStep = async () => {
    const canProceed = await form.trigger('amenities');

    if (!canProceed) {
      return;
    }

    navigateToStep(4);
  };

  const goToVerificationStep = async () => {
    const canProceed = await form.trigger([
      'street',
      'city',
      'region',
      'postal_code',
      'country_code',
      'lat',
      'long'
    ]);

    if (!canProceed) {
      return;
    }

    navigateToStep(5);
  };

  useEffect(() => {
    if (stepParam === null) {
      navigateToStep(1, { replace: true, });
      return;
    }

    if (stepParam !== '1' && stepParam !== '2' && stepParam !== '3' && stepParam !== '4' && stepParam !== '5') {
      navigateToStep(1, { replace: true, });
    }
  }, [navigateToStep, stepParam]);

  useEffect(() => {
    if (!isPersistenceHydrated) {
      return;
    }

    if (currentStep === 2 && !isBasicsStepComplete) {
      navigateToStep(1, { replace: true, });
      return;
    }

    if (currentStep === 3) {
      if (!isBasicsStepComplete) {
        navigateToStep(1, { replace: true, });
        return;
      }

      if (!isPhotoStepComplete) {
        navigateToStep(2, { replace: true, });
        return;
      }
    }

    if (currentStep === 4) {
      if (!isBasicsStepComplete) {
        navigateToStep(1, { replace: true, });
        return;
      }

      if (!isPhotoStepComplete) {
        navigateToStep(2, { replace: true, });
        return;
      }

      if (!isAmenitiesStepComplete) {
        navigateToStep(3, { replace: true, });
        return;
      }

      return;
    }

    if (currentStep === 5) {
      if (!isBasicsStepComplete) {
        navigateToStep(1, { replace: true, });
        return;
      }

      if (!isPhotoStepComplete) {
        navigateToStep(2, { replace: true, });
        return;
      }

      if (!isAmenitiesStepComplete) {
        navigateToStep(3, { replace: true, });
        return;
      }

      if (!isAddressStepComplete) {
        navigateToStep(4, { replace: true, });
      }
    }
  }, [
    currentStep,
    isAddressStepComplete,
    isAmenitiesStepComplete,
    isBasicsStepComplete,
    isPersistenceHydrated,
    isPhotoStepComplete,
    navigateToStep
  ]);

  const handleFeaturedImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFeaturedImage(file);
    event.target.value = '';
  };

  const handleRemoveFeaturedImage = () => {
    setFeaturedImage(null);
    if (featuredImageInputRef.current) {
      featuredImageInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!featuredImage) {
      setFeaturedImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(featuredImage);
    setFeaturedImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [featuredImage]);

  useEffect(() => {
    const urls: string[] = [];
    const previews: Record<string, string[]> = {};

    photoCategories.forEach((category) => {
      previews[category.id] = category.images.map((file) => {
        const url = URL.createObjectURL(file);
        urls.push(url);
        return url;
      });
    });

    setCategoryPreviews(previews);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoCategories]);

  const handleCategoryNameChange = (categoryId: string, nextName: string) => {
    setPhotoCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              name: nextName,
            }
          : category
      )
    );
  };

  const handleAddCategory = () => {
    setPhotoCategories((prev) => [
      ...prev,
      {
        id: generateCategoryId(),
        name: getSampleCategoryName(prev.length),
        images: [],
      }
    ]);
  };

  const handleRemoveCategory = (categoryId: string) => {
    setPhotoCategories((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((category) => category.id !== categoryId);
    });

    delete categoryInputRefs.current[categoryId];
  };

  const handleCategoryImageSelection = (categoryId: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }

    let message: string | null = null;

    setPhotoCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }

        const remainingSlots = MAX_CATEGORY_IMAGES - category.images.length;

        if (remainingSlots <= 0) {
          message = `You can upload up to ${MAX_CATEGORY_IMAGES} photos for this category.`;
          return category;
        }

        const acceptedFiles = files.slice(0, remainingSlots);

        if (acceptedFiles.length < files.length) {
          message = `Only ${remainingSlots} more photo${remainingSlots === 1 ? '' : 's'} fit in ${category.name || 'this category'}.`;
        }

        return {
          ...category,
          images: [...category.images, ...acceptedFiles],
        };
      })
    );

    if (message) {
      toast.error(message);
    }

    event.target.value = '';
  };

  const handleCategoryImageRemove = (categoryId: string, imageIndex: number) => {
    setPhotoCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              images: category.images.filter((_, itemIndex) => itemIndex !== imageIndex),
            }
          : category
      )
    );
  };

  const handleTriggerCategoryPicker = (categoryId: string) => {
    categoryInputRefs.current[categoryId]?.click();
  };

  const handleSubmit = (values: SpaceFormValues) => {
    if (!isListingChecklistComplete) {
      toast.error('Confirm the listing checklist before submitting.');
      return;
    }
    if (!isRequirementsStepComplete) {
      toast.error('Upload all verification requirements before submitting.');
      return;
    }

    const spaceId = createSpace(values);
    toast.success(`${values.name} submitted for review.`);
    clearDraft();
    clearImages();
    resetVerificationRequirements();
    router.push(`/spaces/${spaceId}`);
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Space setup</p>
            <h1 className="text-3xl font-semibold tracking-tight">Add a coworking space</h1>
            <p className="text-base text-muted-foreground">
              Provide the source-of-truth location details so your listing stays accurate across UpSpace.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/spaces" className="inline-flex items-center gap-2">
              <FiArrowLeft className="size-4" aria-hidden="true" />
              Back to spaces
            </Link>
          </Button>
        </div>

        <Card className="mt-6 border-border/70 bg-background/80">
          <CardContent>
            <Form { ...form }>
              <form className="space-y-6" onSubmit={ form.handleSubmit(handleSubmit) }>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-md py-2 text-sm text-muted-foreground">
                    <span>Step { currentStep } of 5</span>
                    <div className="flex gap-1">
                      { STEP_SEQUENCE.map((stepNumber) => (
                        <span
                          key={ stepNumber }
                          className={ `h-1.5 w-10 rounded-full transition ${currentStep >= stepNumber ? 'bg-primary' : 'bg-border/30'}` }
                        />
                      ) ) }
                    </div>
                  </div>
                  { currentStep === 1 ? (
                    <SpaceDetailsFields form={ form } />
                  ) : currentStep === 2 ? (
                    <div className="space-y-6">
                      <div className="rounded-md border border-border/70 bg-background/50 p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Featured image</p>
                            <p className="text-sm text-muted-foreground">
                              Highlight the hero shot visitors see first on your listing.
                            </p>
                          </div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Required</span>
                        </div>
                        <div className="mt-4">
                          { featuredImagePreview ? (
                            <div className="relative">
                              <Image
                                src={ featuredImagePreview }
                                alt={ featuredImage?.name ? `Preview of ${featuredImage.name}` : 'Featured image preview' }
                                width={ 960 }
                                height={ 540 }
                                className="h-56 w-full rounded-md object-cover"
                                sizes="(max-width: 640px) 100vw, 50vw"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">
                              Upload a featured image to preview it here.
                            </div>
                          ) }
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <input
                            ref={ featuredImageInputRef }
                            type="file"
                            accept="image/*"
                            onChange={ handleFeaturedImageSelection }
                            className="sr-only"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={ () => featuredImageInputRef.current?.click() }
                          >
                            { featuredImage ? 'Replace featured image' : 'Upload featured image' }
                          </Button>
                          { featuredImage && (
                            <Button type="button" variant="ghost" onClick={ handleRemoveFeaturedImage }>
                              Remove
                            </Button>
                          ) }
                          { featuredImage && (
                            <span className="truncate text-sm text-muted-foreground">{ featuredImage.name }</span>
                          ) }
                        </div>
                      </div>
                      <div className="rounded-md border border-border/70 bg-background/50 p-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold text-foreground">Area photo categories</p>
                          <p className="text-sm text-muted-foreground">
                            Organize supporting shots by lounge, desk rows, or other sections. Each category holds up to { MAX_CATEGORY_IMAGES } images.
                          </p>
                        </div>
                        <div className="mt-4 space-y-6">
                          { photoCategories.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Add at least one category to begin uploading photos.</p>
                          ) : (
                            photoCategories.map((category, index) => {
                              const previews = categoryPreviews[category.id] ?? [];
                              const canAddMore = category.images.length < MAX_CATEGORY_IMAGES;
                              const inputId = `space-photo-category-${category.id}`;

                              return (
                                <div key={ category.id } className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-4">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                    <div className="flex-1">
                                      <label htmlFor={ inputId } className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Category heading
                                      </label>
                                      <Input
                                        id={ inputId }
                                        value={ category.name }
                                        onChange={ (event) => handleCategoryNameChange(category.id, event.target.value) }
                                        placeholder={ getSampleCategoryName(index) }
                                        aria-label="Photo category name"
                                      />
                                    </div>
                                    { photoCategories.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={ () => handleRemoveCategory(category.id) }
                                      >
                                        <FiTrash className="mr-1 size-4" aria-hidden="true" />
                                        Remove
                                      </Button>
                                    ) }
                                  </div>
                                  <div>
                                    { previews.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">No photos in this category yet.</p>
                                    ) : (
                                      <div
                                        className="flex gap-3 overflow-x-auto pb-2 pt-4"
                                        tabIndex={ 0 }
                                        aria-label="Scroll through category photos"
                                      >
                                        { previews.map((url, imageIndex) => (
                                          <div
                                            key={ `${category.id}-${imageIndex}` }
                                            className="relative flex min-w-[11rem] flex-col gap-1 rounded-lg border border-border/60 bg-background/80 p-1"
                                          >
                                            <button
                                              type="button"
                                              onClick={ () => handleCategoryImageRemove(category.id, imageIndex) }
                                              className="cursor-pointer absolute right-0 top-0 z-10 inline-flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                              aria-label={ category.images[imageIndex]?.name ? `Remove ${category.images[imageIndex]?.name}` : 'Remove photo' }
                                            >
                                              <FiX aria-hidden="true" className="size-3" />
                                            </button>
                                            <Image
                                              src={ url }
                                              alt="Category photo preview"
                                              width={ 400 }
                                              height={ 280 }
                                              className="h-28 w-full rounded-md object-cover"
                                              sizes="(max-width: 640px) 75vw, 20vw"
                                              unoptimized
                                            />
                                            <span className="truncate text-[11px] text-muted-foreground">{ category.images[imageIndex]?.name }</span>
                                          </div>
                                        )) }
                                      </div>
                                    ) }
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <input
                                      ref={ (element) => {
                                        if (element) {
                                          categoryInputRefs.current[category.id] = element;
                                        } else {
                                          delete categoryInputRefs.current[category.id];
                                        }
                                      } }
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="sr-only"
                                      onChange={ (event) => handleCategoryImageSelection(category.id, event) }
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={ () => handleTriggerCategoryPicker(category.id) }
                                      disabled={ !canAddMore }
                                    >
                                      Upload photos
                                    </Button>
                                    <span className="text-xs text-muted-foreground">
                                      { category.images.length } / { MAX_CATEGORY_IMAGES } selected
                                      { !canAddMore ? ' · Remove a photo to add another.' : '' }
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          ) }
                          <Button type="button" variant="outline" onClick={ handleAddCategory }>
                            <FiPlus className="mr-2 size-4" aria-hidden="true" />
                            Add another category
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : currentStep === 3 ? (
                    <SpaceAmenitiesStep form={ form } />
                  ) : currentStep === 4 ? (
                    <SpaceAddressFields form={ form } />
                  ) : (
                    <SpaceVerificationRequirementsStep
                      uploads={ verificationRequirements }
                      onUpload={ handleRequirementUpload }
                      onRemove={ handleRequirementRemove }
                    />
                  ) }
                </div>
                { currentStep === 5 && (
                  <div className="mt-4 rounded-lg border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Listing checklist</p>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Required</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Confirm these reminders to satisfy our hosting guidelines before submitting.
                    </p>
                    <div className="mt-3 space-y-2">
                      { spaceListingChecklist.map((item) => (
                        <label key={ item.id } className="flex items-start gap-2 text-sm text-foreground">
                          <Checkbox
                            checked={ listingChecklistState[item.id] }
                            onCheckedChange={ (checked) =>
                              setListingChecklistState((prev) => ({
                                ...prev,
                                [item.id]: Boolean(checked),
                              }))
                            }
                            aria-describedby={ `listing-checklist-${item.id}` }
                          />
                          <span id={ `listing-checklist-${item.id}` } className="leading-relaxed">
                            { item.content }
                          </span>
                        </label>
                      )) }
                    </div>
                  </div>
                ) }
                <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={ () => {
                      clearDraft();
                      clearImages();
                      resetVerificationRequirements();
                      router.push('/spaces');
                    } }
                  >
                    Cancel
                  </Button>
                  <div className="flex items-center gap-2">
                    { currentStep === 1 && (
                      <Button type="button" disabled={ !isBasicsStepComplete } onClick={ goToPhotoStep }>
                        Next
                        <FiArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    ) }
                    { currentStep === 2 && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={ () => navigateToStep(1) }
                        >
                          <FiArrowLeft className="size-4" aria-hidden="true" />
                          Back
                        </Button>
                        <Button type="button" disabled={ !isPhotoStepComplete } onClick={ goToAmenitiesStep }>
                          Next
                          <FiArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) }
                    { currentStep === 3 && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={ () => navigateToStep(2) }
                        >
                          <FiArrowLeft className="size-4" aria-hidden="true" />
                          Back
                        </Button>
                        <Button type="button" disabled={ !isAmenitiesStepComplete } onClick={ goToAddressStep }>
                          Next
                          <FiArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) }
                    { currentStep === 4 && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={ () => navigateToStep(3) }
                        >
                          <FiArrowLeft className="size-4" aria-hidden="true" />
                          Back
                        </Button>
                        <Button type="button" disabled={ !isAddressStepComplete } onClick={ goToVerificationStep }>
                          Next
                          <FiArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) }
                    { currentStep === 5 && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={ () => navigateToStep(4) }
                        >
                          <FiArrowLeft className="size-4" aria-hidden="true" />
                          Back
                        </Button>
                        <Button type="submit" disabled={ !isRequirementsStepComplete || !isListingChecklistComplete }>
                          <MdOutlineMailOutline className="size-4" aria-hidden="true" />
                          Submit for Review
                        </Button>
                      </>
                    ) }
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
