'use client';

import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PriceRuleFormShell, usePriceRuleFormState } from './PriceRuleDialog';
import { SpacesBreadcrumbs } from './SpacesBreadcrumbs';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreatePriceRuleMutation, usePartnerSpacesQuery } from '@/hooks/api/usePartnerSpaces';
import type { PriceRuleFormValues } from '@/lib/pricing-rules';

export function PriceRuleCreationPage() {
  const router = useRouter();
  const {
    data: spaces,
    isLoading,
    isError,
    error,
  } = usePartnerSpacesQuery();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const formState = usePriceRuleFormState();
  const createPriceRuleMutation = useCreatePriceRuleMutation(selectedSpaceId ?? '');

  useEffect(() => {
    if (!selectedSpaceId && spaces?.length) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [selectedSpaceId, spaces]);

  const handleSubmit = async (values: PriceRuleFormValues) => {
    if (!selectedSpaceId) {
      toast.error('Select a space before saving a pricing rule.');
      return;
    }

    try {
      await createPriceRuleMutation.mutateAsync(values);
      toast.success('Pricing rule saved.');
      router.push('/partner/spaces/pricing-rules');
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save pricing rule.'
      );
    }
  };

  return (
    <div className="w-full px-4 pb-8 pt-8 sm:px-6 lg:px-10">
      <SpacesBreadcrumbs currentPage="New pricing rule" className="mt-6 mb-4 sm:mb-6" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Create pricing rule
          </h1>
          <p className="text-sm text-muted-foreground md:text-base max-w-2xl">
            Capture reusable pricing logic once and deploy it across all of your spaces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link
              href="/partner/spaces/pricing-rules"
              className="flex items-center gap-2 text-sm hover:text-white"
            >
              <FiArrowLeft className="size-4" aria-hidden="true" />
              <span>Back to price rules</span>
            </Link>
          </Button>
        </div>
      </div>

      <Card className="mt-6 border-border/70 bg-background/80">
        <CardHeader className="flex flex-col gap-1">
          <CardTitle className="text-lg">Target space</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Select the listing to associate with this rule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          { isError ? (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-destructive">
              { error instanceof Error ? error.message : 'Unable to load spaces.' }
            </div>
          ) : (
            <>
              { spaces ? (
                <Select
                  value={ selectedSpaceId ?? undefined }
                  onValueChange={ (value) => setSelectedSpaceId(value) }
                  disabled={ !spaces.length }
                >
                  <SelectTrigger className="min-w-[12rem] text-sm">
                    <SelectValue placeholder="Select space" />
                  </SelectTrigger>
                  <SelectContent>
                    { spaces.map((space) => (
                      <SelectItem key={ space.id } value={ space.id }>
                        { space.name }
                      </SelectItem>
                    )) }
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-10 w-40 rounded-md" />
              ) }

              <PriceRuleFormShell
                { ...formState }
                mode="create"
                isSubmitting={ createPriceRuleMutation.isPending }
                onSubmit={ handleSubmit }
                onCancel={ () => router.push('/partner/spaces/pricing-rules') }
              />
            </>
          ) }
        </CardContent>
      </Card>
    </div>
  );
}
