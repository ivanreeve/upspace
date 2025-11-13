'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
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
import NavBar from '@/components/ui/navbar';
import { useSpacesStore } from '@/stores/useSpacesStore';

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
    countryCodeValue,
  ] = form.watch([
    'name',
    'description',
    'unit_number',
    'address_subunit',
    'street',
    'city',
    'region',
    'postal_code',
    'country_code',
  ]);

  const normalize = (value?: string) => (value ?? '').trim();

  const isStepOneComplete =
    normalize(nameValue).length > 0 && normalize(descriptionValue).length >= 20;

  const isStepTwoComplete =
    normalize(unitNumberValue).length > 0 &&
    normalize(addressSubunitValue).length > 0 &&
    normalize(streetValue).length > 0 &&
    normalize(cityValue).length > 0 &&
    normalize(regionValue).length > 0 &&
    normalize(postalCodeValue).length === 4 &&
    normalize(countryCodeValue).length === 2;

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const goToNextStep = async () => {
    const canProceed = await form.trigger(['name', 'description']);

    if (canProceed) {
      setCurrentStep(2);
    }
  };

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return;
    }

    setSelectedImages(Array.from(event.target.files));
  };

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
            <CardDescription>Start with the space basics and optional photos, then complete the canonical address on the next page.</CardDescription>
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
                          Add visuals now or revisit this section after the address step.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          { selectedImages.length === 0 ? (
                            <span>No files selected yet.</span>
                          ) : (
                            selectedImages.map((file, index) => (
                              <span key={ `${file.name}-${index}` } className="rounded-full border border-border/60 px-3 py-1">
                                { file.name }
                              </span>
                            ))
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
                          >
                            Select photos
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            { selectedImages.length } selected
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
