'use client';

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FiArrowLeft, FiArrowRight, FiX } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  SpaceAddressFields,
  SpaceDetailsFields,
  createSpaceFormDefaults,
  spaceSchema,
  SpaceFormValues
} from '@/components/pages/Spaces/SpaceForms';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { richTextPlainTextLength } from '@/lib/rich-text';
import NavBar from '@/components/ui/navbar';
import { useSpacesStore } from '@/stores/useSpacesStore';

const MAX_IMAGE_COUNT = 5;

export default function SpaceCreateRoute() {
  const router = useRouter();
  const createSpace = useSpacesStore((state) => state.createSpace);

  const form = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: createSpaceFormDefaults(),
  });

  const [
    nameValue,
    descriptionValue,
    unitNumberValue,
    addressSubunitValue,
    streetValue,
    cityValue,
    regionValue,
    postalCodeValue,
    countryCodeValue
  ] = form.watch([
    'name',
    'description',
    'unit_number',
    'address_subunit',
    'street',
    'city',
    'region',
    'postal_code',
    'country_code'
  ]);

  const normalize = (value?: string) => (value ?? '').trim();

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const canAddMoreImages = selectedImages.length < MAX_IMAGE_COUNT;

  const isStepOneComplete =
    normalize(nameValue).length > 0 &&
    richTextPlainTextLength(descriptionValue ?? '') >= 20 &&
    selectedImages.length > 0;

  const isStepTwoComplete =
    normalize(unitNumberValue).length > 0 &&
    normalize(addressSubunitValue).length > 0 &&
    normalize(streetValue).length > 0 &&
    normalize(cityValue).length > 0 &&
    normalize(regionValue).length > 0 &&
    normalize(postalCodeValue).length === 4 &&
    normalize(countryCodeValue).length === 2;

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const goToNextStep = async () => {
    const canProceed = await form.trigger(['name', 'description']);

    if (!canProceed) {
      return;
    }

    if (selectedImages.length === 0) {
      toast.error('Upload at least one photo before continuing.');
      return;
    }

    setCurrentStep(2);
  };

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return;
    }

    const incomingFiles = Array.from(event.target.files);
    if (incomingFiles.length === 0) {
      return;
    }

    setSelectedImages((prev) => {
      const next = [...prev];

      for (const file of incomingFiles) {
        if (next.length >= MAX_IMAGE_COUNT) {
          toast.error(`You can upload up to ${MAX_IMAGE_COUNT} photos.`);
          break;
        }

        next.push(file);
      }

      return next;
    });

    // Reset the input so the same file can be reselected if needed.
    event.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  useEffect(() => {
    const previews = selectedImages.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);

    return () => {
      previews.forEach(URL.revokeObjectURL);
    };
  }, [selectedImages]);

  const previewItems = selectedImages.map((file, index) => ({
    file,
    url: imagePreviews[index],
  }));

  const handleSubmit = (values: SpaceFormValues) => {
    const spaceId = createSpace(values);
    toast.success(`${values.name} created.`);
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

        <Card className="mt-8 border-border/70 bg-background/80">
          <CardHeader>
            <CardTitle>Space information</CardTitle>
            <CardDescription>Start with the space basics and at least one photo, then complete the canonical address on the next page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form { ...form }>
              <form className="space-y-6" onSubmit={ form.handleSubmit(handleSubmit) }>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/5 px-4 py-2 text-sm text-muted-foreground">
                    <span>Step { currentStep } of 2</span>
                    <div className="flex gap-1">
                      { [1, 2].map((stepNumber) => (
                        <span
                          key={ stepNumber }
                          className={ `h-1.5 w-10 rounded-full transition ${currentStep >= stepNumber ? 'bg-primary' : 'bg-border/30'}` }
                        />
                      ) ) }
                    </div>
                  </div>
                  { currentStep === 1 ? (
                    <>
                      <div className="rounded-md border border-border/70 bg-background/50 p-4">
                        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                          <span>Pictures</span>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Required</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add visuals now or revisit this section after the address step. <span className="font-semibold text-foreground">Maximum { MAX_IMAGE_COUNT } photos.</span>
                        </p>
                        <div className="mt-3">
                          { previewItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No files selected yet.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              { previewItems.map((preview, index) => {
                                const {
                                  file,
                                  url,
                                } = preview;

                                return (
                                  <div
                                    key={ `${file.name}-${index}` }
                                    className="relative flex flex-col gap-1 rounded-lg border border-border/60 bg-background/80 p-1"
                                  >
                                    <button
                                      type="button"
                                      onClick={ () => handleRemoveImage(index) }
                                      className="absolute right-1 bottom-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition hover:bg-background"
                                      aria-label={ `Remove ${file.name}` }
                                    >
                                      <FiX aria-hidden="true" className="size-3" />
                                    </button>
                                    { url ? (
                                      <Image
                                        src={ url }
                                        alt={ `Preview of ${file.name}` }
                                        width={ 400 }
                                        height={ 280 }
                                        className="h-28 w-full rounded-md object-cover"
                                        sizes="(max-width: 640px) 100vw, 33vw"
                                        unoptimized
                                      />
                                    ) : (
                                      <div className="flex h-28 items-center justify-center rounded-md bg-muted/20 text-[10px] text-muted-foreground">
                                        Preparing preview...
                                      </div>
                                    ) }
                                    <span className="truncate text-[11px] text-muted-foreground">{ file.name }</span>
                                  </div>
                                );
                              }) }
                            </div>
                          ) }
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <input
                            ref={ imageInputRef }
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={ handleImageSelection }
                            className="sr-only"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={ () => imageInputRef.current?.click() }
                            disabled={ !canAddMoreImages }
                          >
                            Select photos
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            { selectedImages.length } / { MAX_IMAGE_COUNT } selected
                            { !canAddMoreImages ? ' · Remove a photo to add another.' : '' }
                          </span>
                        </div>
                      </div>
                      <SpaceDetailsFields form={ form } />
                    </>
                  ) : (
                    <SpaceAddressFields form={ form } />
                  ) }
                </div>
                <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" onClick={ () => router.push('/spaces') }>
                    Cancel
                  </Button>
                  <div className="flex items-center gap-2">
                    { currentStep === 1 ? (
                      <Button type="button" disabled={ !isStepOneComplete } onClick={ goToNextStep }>
                        Next
                        <FiArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={ !isStepOneComplete }
                          onClick={ () => setCurrentStep(1) }
                        >
                          <FiArrowLeft className="size-4" aria-hidden="true" />
                          Back
                        </Button>
                        <Button type="submit" disabled={ !isStepTwoComplete }>
                          Save space
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
