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
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, type FieldPathValues } from 'react-hook-form';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCamera,
  FiCheck,
  FiCalendar,
  FiHome,
  FiList,
  FiMapPin,
  FiPlus,
  FiShield,
  FiTrash,
  FiX
} from 'react-icons/fi';
import { CgSpinner } from 'react-icons/cg';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { MdOutlineMailOutline } from 'react-icons/md';
import type { IconType } from 'react-icons';

import { SpaceAddressFields, SpaceDetailsFields, createSpaceFormDefaults } from '@/components/pages/Spaces/SpaceForms';
import { SpaceAmenitiesStep } from '@/components/pages/Spaces/SpaceAmenitiesStep';
import { SpaceAvailabilityStep } from '@/components/pages/Spaces/SpaceAvailabilityStep';
import { SpaceVerificationRequirementsStep, VERIFICATION_REQUIREMENTS, type VerificationRequirementId } from '@/components/pages/Spaces/SpaceVerificationRequirementsStep';
import { SpacesBreadcrumbs } from '@/components/pages/Spaces/SpacesBreadcrumbs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { type AgreementChecklistItem } from '@/components/ui/AgreementChecklist';
import { Form } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { richTextPlainTextLength } from '@/lib/rich-text';
import { useSession } from '@/components/auth/SessionProvider';
import { useSpaceFormPersistence } from '@/hooks/useSpaceFormPersistence';
import { usePersistentSpaceImages } from '@/hooks/usePersistentSpaceImages';
import { WEEKDAY_ORDER } from '@/data/spaces';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { partnerSpacesKeys } from '@/hooks/api/usePartnerSpaces';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { spaceSchema, type SpaceFormValues } from '@/lib/validations/spaces';
import { cn } from '@/lib/utils';

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
const minutesFromTime = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.NaN;
};
const WATCHED_FIELD_NAMES = ['name', 'description', 'street', 'city', 'region', 'postal_code', 'country_code', 'lat', 'long'] as const;
type WatchedFieldNames = typeof WATCHED_FIELD_NAMES;
type WatchedFieldValues = FieldPathValues<SpaceFormValues, WatchedFieldNames>;
type SpaceFormStep = 1 | 2 | 3 | 4 | 5 | 6;
const STEP_SEQUENCE: SpaceFormStep[] = [1, 2, 3, 4, 5, 6];
type StepSidebarItem = {
  step: SpaceFormStep;
  label: string;
  icon: IconType;
};
const STEP_SIDEBAR_ITEMS: StepSidebarItem[] = [
  {
    step: 1,
    label: 'Space details',
    icon: FiHome,
  },
  {
    step: 2,
    label: 'Photos',
    icon: FiCamera,
  },
  {
    step: 3,
    label: 'Amenities',
    icon: FiList,
  },
  {
    step: 4,
    label: 'Address',
    icon: FiMapPin,
  },
  {
    step: 5,
    label: 'Availability',
    icon: FiCalendar,
  },
  {
    step: 6,
    label: 'Verification',
    icon: FiShield,
  }
];
type VerificationRequirementsState = Record<VerificationRequirementId, (File | null)[]>;

const createEmptyVerificationRequirementsState = (): VerificationRequirementsState =>
  VERIFICATION_REQUIREMENTS.reduce((state, requirement) => {
    state[requirement.id] = requirement.slots.map(() => null);
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

const SPACE_IMAGES_BUCKET = process.env.NEXT_PUBLIC_SPACE_IMAGES_BUCKET ?? 'upspace-uploads-space-images';
const VERIFICATION_DOCS_BUCKET = process.env.NEXT_PUBLIC_VERIFICATION_DOCS_BUCKET ?? 'upspace-verification-documents';
const SPACE_IMAGES_PREFIX = 'space-images';
const VERIFICATION_DOCS_PREFIX = 'verification-documents';

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'file';

const createRandomSuffix = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const buildStorageObjectPath = (prefix: string, ownerId: string, fileName: string) =>
  [
    prefix,
    ownerId,
    `${Date.now()}-${createRandomSuffix()}-${sanitizeFileName(fileName)}`
  ]
    .filter(Boolean)
    .join('/');

const SPACE_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
const SPACE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const VERIFICATION_DOC_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;
const VERIFICATION_DOC_MAX_BYTES = 10 * 1024 * 1024;

type UploadedSpaceImagePayload = {
  path: string;
  category?: string;
  is_primary: boolean;
  display_order: number;
};

type UploadedVerificationDocumentPayload = {
  path: string;
  requirement_id: VerificationRequirementId;
  slot_id: string;
  mime_type: string;
  file_size_bytes: number;
};

type CreateSpaceApiResponse = {
  data: {
    space_id: string;
    created_at: string;
    name: string;
  };
};

type SubmissionAssets = {
  images: UploadedSpaceImagePayload[];
  verification_documents: UploadedVerificationDocumentPayload[];
};

const buildCreateSpacePayload = (values: SpaceFormValues, assets: SubmissionAssets) => {
  const availability = WEEKDAY_ORDER.reduce((record, day) => {
    const slot = values.availability?.[day];
    if (slot) {
      record[day] = {
        is_open: Boolean(slot.is_open),
        opens_at: slot.opens_at,
        closes_at: slot.closes_at,
      };
    }
    return record;
  }, {} as SpaceFormValues['availability']);

  return {
    name: values.name.trim(),
    description: values.description,
    unit_number: values.unit_number?.trim() ?? '',
    address_subunit: values.address_subunit?.trim() ?? '',
    street: values.street.trim(),
    barangay: values.barangay?.trim() ?? '',
    city: values.city.trim(),
    region: values.region.trim(),
    postal_code: values.postal_code.trim(),
    country_code: values.country_code.trim(),
    lat: values.lat,
    long: values.long,
    amenities: (values.amenities ?? []).filter((amenity): amenity is string => Boolean(amenity)),
    availability,
    images: assets.images,
    verification_documents: assets.verification_documents,
  } satisfies Record<string, unknown>;
};

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

const normalizeMimeType = (mime: string) => {
  const normalized = (mime ?? '').trim().toLowerCase();
  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }
  return normalized;
};

export default function SpaceCreateRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, } = useSession();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const queryClient = useQueryClient();
  const storageOwnerId = session?.user?.id ?? 'anonymous';
  const serializedSearchParams = searchParams.toString();
  const stepParam = searchParams.get('step');
  const authenticatedFetch = useAuthenticatedFetch();
  const currentStep: SpaceFormStep =
    stepParam === '2'
      ? 2
      : stepParam === '3'
        ? 3
        : stepParam === '4'
          ? 4
          : stepParam === '5'
            ? 5
            : stepParam === '6'
              ? 6
              : 1;
  const form = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: createSpaceFormDefaults(),
  });
  const {
    clearDraft,
    isHydrated: isFormHydrated,
  } = useSpaceFormPersistence(form);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    countryCodeValue = '',
    latValue = 0,
    longValue = 0
  ] = watchedArray;

  const selectedAmenities = useWatch<SpaceFormValues, 'amenities'>({
    control: form.control,
    name: 'amenities',
    defaultValue: form.getValues('amenities'),
  }) ?? [];

  const weeklyAvailability = useWatch<SpaceFormValues, 'availability'>({
    control: form.control,
    name: 'availability',
    defaultValue: form.getValues('availability'),
  });

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

  const handleRequirementUpload = (requirementId: VerificationRequirementId, slotIndex: number, file: File) => {
    setVerificationRequirements((prev) => {
      const nextSlots = [ ...prev[requirementId] ];
      nextSlots[slotIndex] = file;

      return {
        ...prev,
        [requirementId]: nextSlots,
      };
    });
  };

  const handleRequirementRemove = (requirementId: VerificationRequirementId, slotIndex: number) => {
    setVerificationRequirements((prev) => {
      const nextSlots = [ ...prev[requirementId] ];
      nextSlots[slotIndex] = null;

      return {
        ...prev,
        [requirementId]: nextSlots,
      };
    });
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
    normalize(countryCodeValue).length === 2 &&
    typeof latValue === 'number' &&
    typeof longValue === 'number' &&
    !Number.isNaN(latValue) &&
    !Number.isNaN(longValue);

  const isAvailabilityStepComplete = useMemo(() => {
    if (!weeklyAvailability) {
      return false;
    }

    let hasOpenDay = false;

    for (const day of WEEKDAY_ORDER) {
      const slot = weeklyAvailability[day];
      if (!slot) {
        return false;
      }

      if (!slot.is_open) {
        continue;
      }

      hasOpenDay = true;
      const openMinutes = minutesFromTime(slot.opens_at);
      const closeMinutes = minutesFromTime(slot.closes_at);

      if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes) || closeMinutes <= openMinutes) {
        return false;
      }
    }

    return hasOpenDay;
  }, [weeklyAvailability]);

  const isRequirementsStepComplete = VERIFICATION_REQUIREMENTS.every((requirement) =>
    requirement.slots.every((_, slotIndex) => Boolean(verificationRequirements[requirement.id][slotIndex]))
  );

  const stepCompletionStatus = useMemo<Record<SpaceFormStep, boolean>>(
    () => ({
      1: isBasicsStepComplete,
      2: isPhotoStepComplete,
      3: isAmenitiesStepComplete,
      4: isAddressStepComplete,
      5: isAvailabilityStepComplete,
      6: isRequirementsStepComplete,
    }),
    [
      isAddressStepComplete,
      isAmenitiesStepComplete,
      isAvailabilityStepComplete,
      isBasicsStepComplete,
      isPhotoStepComplete,
      isRequirementsStepComplete
    ]
  );

  const stepAccessibility = useMemo<Record<SpaceFormStep, boolean>>(
    () => ({
      1: true,
      2: isBasicsStepComplete,
      3: isPhotoStepComplete,
      4: isAmenitiesStepComplete,
      5: isAddressStepComplete,
      6: isAvailabilityStepComplete,
    }),
    [
      isAddressStepComplete,
      isAmenitiesStepComplete,
      isAvailabilityStepComplete,
      isBasicsStepComplete,
      isPhotoStepComplete
    ]
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

  const goToAvailabilityStep = async () => {
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

  const goToVerificationStep = async () => {
    const canProceed = await form.trigger('availability');

    if (!canProceed) {
      return;
    }

    navigateToStep(6);
  };

  useEffect(() => {
    if (stepParam === null) {
      navigateToStep(1, { replace: true, });
      return;
    }

    if (stepParam !== '1' && stepParam !== '2' && stepParam !== '3' && stepParam !== '4' && stepParam !== '5' && stepParam !== '6') {
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
        return;
      }

      return;
    }

    if (currentStep === 6) {
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
        return;
      }

      if (!isAvailabilityStepComplete) {
        navigateToStep(5, { replace: true, });
      }
    }
  }, [
    currentStep,
    isAddressStepComplete,
    isAvailabilityStepComplete,
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

  const ensureFileWithinConstraints = (
    file: File,
    allowedMimeTypes: readonly string[],
    maxBytes: number,
    label: string
  ) => {
    const normalizedMime = normalizeMimeType(file.type ?? '');
    if (!normalizedMime || !allowedMimeTypes.includes(normalizedMime)) {
      throw new Error(`${label} must be one of: ${allowedMimeTypes.join(', ')}.`);
    }

    if (file.size > maxBytes) {
      throw new Error(`${label} must be ${formatBytes(maxBytes)} or smaller.`);
    }

    return normalizedMime;
  };

  const uploadToSupabase = useCallback(
    async (
      bucket: string,
      objectPath: string,
      file: File,
      contentType: string
    ) => {
      const uploadOptions = {
        cacheControl: '3600',
        contentType,
        upsert: false,
      };

      const { error, } = await supabase.storage.from(bucket).upload(
        objectPath,
        file,
        uploadOptions
      );

      if (error) {
        throw new Error(error.message ?? 'Failed to upload file to storage.');
      }
    },
    [supabase]
  );

  const uploadSpaceImageFile = async (file: File) => {
    const normalizedMime = ensureFileWithinConstraints(
      file,
      SPACE_IMAGE_MIME_TYPES,
      SPACE_IMAGE_MAX_BYTES,
      'Space images'
    );

    const objectPath = buildStorageObjectPath(SPACE_IMAGES_PREFIX, storageOwnerId, file.name);
    await uploadToSupabase(SPACE_IMAGES_BUCKET, objectPath, file, normalizedMime);

    return `${SPACE_IMAGES_BUCKET}/${objectPath}`;
  };

  const uploadVerificationDocumentFile = async (
    requirementId: VerificationRequirementId,
    file: File
  ) => {
    const normalizedMime = ensureFileWithinConstraints(
      file,
      VERIFICATION_DOC_MIME_TYPES,
      VERIFICATION_DOC_MAX_BYTES,
      'Verification documents'
    );

    const prefix = `${VERIFICATION_DOCS_PREFIX}/${requirementId}`;
    const objectPath = buildStorageObjectPath(prefix, storageOwnerId, file.name);
    await uploadToSupabase(VERIFICATION_DOCS_BUCKET, objectPath, file, normalizedMime);

    return {
      path: `${VERIFICATION_DOCS_BUCKET}/${objectPath}`,
      mimeType: normalizedMime,
    };
  };

  const uploadSpaceImages = async (): Promise<UploadedSpaceImagePayload[]> => {
    if (!featuredImage) {
      throw new Error('Upload a featured image before submitting.');
    }

    const uploads: UploadedSpaceImagePayload[] = [];
    let displayOrder = 0;

    const featuredPath = await uploadSpaceImageFile(featuredImage);
    uploads.push({
      path: featuredPath,
      category: 'featured',
      is_primary: true,
      display_order: displayOrder,
    });
    displayOrder += 1;

    for (const category of photoCategories) {
      const categoryName = category.name.trim();
      for (const imageFile of category.images) {
        const path = await uploadSpaceImageFile(imageFile);
        uploads.push({
          path,
          category: categoryName || undefined,
          is_primary: false,
          display_order: displayOrder,
        });
        displayOrder += 1;
      }
    }

    return uploads;
  };

  const uploadVerificationDocuments = async (): Promise<UploadedVerificationDocumentPayload[]> => {
    const uploads: UploadedVerificationDocumentPayload[] = [];

    for (const requirement of VERIFICATION_REQUIREMENTS) {
      const slotFiles = verificationRequirements[requirement.id] ?? [];
      requirement.slots.forEach((_slot, index) => {
        if (!slotFiles[index]) {
          throw new Error(`Missing required document for ${requirement.label}.`);
        }
      });
    }

    for (const requirement of VERIFICATION_REQUIREMENTS) {
      const slotFiles = verificationRequirements[requirement.id] ?? [];
      for (let index = 0; index < requirement.slots.length; index += 1) {
        const slot = requirement.slots[index];
        const file = slotFiles[index];
        if (!file) {
          throw new Error(`Missing required document for ${requirement.label}.`);
        }

        const {
          path,
          mimeType,
        } = await uploadVerificationDocumentFile(requirement.id, file);
        uploads.push({
          path,
          requirement_id: requirement.id,
          slot_id: slot.id,
          mime_type: mimeType,
          file_size_bytes: file.size,
        });
      }
    }

    return uploads;
  };

  const uploadSubmissionAssets = async (): Promise<SubmissionAssets> => {
    const images = await uploadSpaceImages();
    const verification_documents = await uploadVerificationDocuments();
    return {
      images,
      verification_documents,
    };
  };

  const handleSubmit = async (values: SpaceFormValues) => {
    if (!isListingChecklistComplete) {
      toast.error('Confirm the listing checklist before submitting.');
      return;
    }
    if (!isRequirementsStepComplete) {
      toast.error('Upload all verification requirements before submitting.');
      return;
    }
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const assets = await uploadSubmissionAssets();
      const requestPayload = buildCreateSpacePayload(values, assets);
      const response = await authenticatedFetch('/api/v1/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(requestPayload),
      });

      const responseBody = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof responseBody?.error === 'string'
          ? responseBody.error
          : 'Failed to submit the space. Please try again.';
        throw new Error(message);
      }

      const payload = responseBody as CreateSpaceApiResponse;
      const spaceId = payload?.data?.space_id;

      if (!spaceId) {
        throw new Error('Space submission succeeded but no ID was returned.');
      }

      toast.success(`${values.name} submitted for review.`);
      queryClient.invalidateQueries({ queryKey: partnerSpacesKeys.list(), });
      clearDraft();
      clearImages();
      resetVerificationRequirements();
      router.push('/spaces');
    } catch (error) {
      console.error('Failed to submit space', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit the space. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Space setup</p>
            <h1 className="text-3xl font-semibold tracking-tight">Add a coworking space</h1>
            <p className="text-base text-muted-foreground">
              Provide the source-of-truth location details so your listing stays accurate across UpSpace.
            </p>
          </div>
          <div className="w-full sm:w-auto sm:justify-end sm:flex">
            <SpacesBreadcrumbs currentPage="Add space" className="justify-start sm:justify-end" />
          </div>
        </div>

        <Card className="mt-6 border-border/70 bg-background/80">
          <CardContent>
            <Form { ...form }>
              <form
                className="grid gap-6 lg:grid-cols-[240px_1fr]"
                onSubmit={ form.handleSubmit(handleSubmit) }
              >
                <aside className="space-y-5 bg-background/80 p-5 lg:sticky lg:top-4 lg:self-start">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Step navigation</p>
                    <p className="text-sm font-semibold text-foreground">Follow the flow</p>
                  </div>
                  <nav className="space-y-2" aria-label="Space setup steps">
                    { STEP_SIDEBAR_ITEMS.map((item) => {
                      const isCurrent = item.step === currentStep;
                      const isAccessible = stepAccessibility[item.step];
                      const isComplete = stepCompletionStatus[item.step];
                      const Icon = item.icon;
                      return (
                        <button
                          key={ item.step }
                          type="button"
                          className={ cn(
                            'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            isCurrent ? 'border-primary bg-primary/10' : 'border-border/60 bg-background/80',
                            !isAccessible && 'cursor-not-allowed opacity-60'
                          ) }
                          disabled={ !isAccessible }
                          aria-current={ isCurrent ? 'step' : undefined }
                          onClick={ () => {
                            if (!isAccessible || isCurrent) {
                              return;
                            }
                            navigateToStep(item.step);
                          } }
                        >
                          <span className="sr-only">Step { item.step }</span>
                          <div className="flex items-center gap-2">
                            <Icon className="size-4" aria-hidden="true" />
                            <span className="text-sm font-semibold text-foreground">{ item.label }</span>
                          </div>
                          { isComplete && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                              <FiCheck className="size-3" aria-hidden="true" />
                              Complete
                            </span>
                          ) }
                        </button>
                      );
                    }) }
                  </nav>
                  <p className="text-xs text-muted-foreground">
                    Locked steps unlock when the previous section is completed.
                  </p>
                </aside>
                <div className="space-y-6">
                  <div className="space-y-4">
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
                  ) : currentStep === 5 ? (
                    <SpaceAvailabilityStep form={ form } />
                  ) : (
                    <SpaceVerificationRequirementsStep
                      uploads={ verificationRequirements }
                      onUpload={ handleRequirementUpload }
                      onRemove={ handleRequirementRemove }
                    />
                  ) }
                </div>
                { currentStep === 6 && (
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
                    disabled={ isSubmitting }
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
                        <Button type="button" disabled={ !isAddressStepComplete } onClick={ goToAvailabilityStep }>
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
                        <Button type="button" disabled={ !isAvailabilityStepComplete } onClick={ goToVerificationStep }>
                          Next
                          <FiArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) }
                    { currentStep === 6 && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={ isSubmitting }
                          onClick={ () => navigateToStep(5) }
                        >
                          <FiArrowLeft className="size-4" aria-hidden="true" />
                          Back
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            !isRequirementsStepComplete ||
                            !isListingChecklistComplete
                          }
                        >
                          { isSubmitting ? (
                            <>
                              <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <MdOutlineMailOutline className="size-4" aria-hidden="true" />
                              <span>Submit for Review</span>
                            </>
                          ) }
                        </Button>
                      </>
                    ) }
                  </div>
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
