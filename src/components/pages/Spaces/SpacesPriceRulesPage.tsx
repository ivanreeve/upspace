'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
FiEdit,
FiLoader,
FiPlay,
FiPlus,
FiTrash2
} from 'react-icons/fi';
import { GoArrowUpRight } from 'react-icons/go';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

import { SpacesBreadcrumbs } from './SpacesBreadcrumbs';

const PriceRuleDialog = dynamic(() => import('./PriceRuleDialog'), { ssr: false, });

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  useCreatePriceRuleMutation,
  useDeletePriceRuleMutation,
  usePartnerSpacesQuery,
  useUpdatePriceRuleMutation
} from '@/hooks/api/usePartnerSpaces';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { PriceRuleFormValues, PriceRuleRecord } from '@/lib/pricing-rules';

const priceRuleDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function SpacesPriceRulesPage() {
  const {
    data: spaces,
    isError,
    isLoading,
    error,
    refetch,
  } = usePartnerSpacesQuery();

  const router = useRouter();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [priceRuleDialogOpen, setPriceRuleDialogOpen] = useState(false);
  const [editingPriceRule, setEditingPriceRule] =
    useState<PriceRuleRecord | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [testingRule, setTestingRule] = useState<PriceRuleRecord | null>(null);
  const [testBookingHours, setTestBookingHours] = useState('1');
  const [testGuestCount, setTestGuestCount] = useState('1');
  const [testStartAt, setTestStartAt] = useState('');
  const [testResult, setTestResult] = useState<{
    price: number | null;
    unitPrice: number | null;
    branch: string | null;
    appliedExpression: string | null;
    conditionsSatisfied: boolean;
    guestMultiplierApplied: boolean;
  } | null>(null);
  const [isTestingLoading, setIsTestingLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const authFetch = useAuthenticatedFetch();

  useEffect(() => {
    if (!selectedSpaceId && spaces?.length) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [selectedSpaceId, spaces]);

  const selectedSpace = useMemo(
    () => spaces?.find((space) => space.id === selectedSpaceId) ?? null,
    [selectedSpaceId, spaces]
  );

  const rules = useMemo(
    () => selectedSpace?.pricing_rules ?? [],
    [selectedSpace]
  );

  const deletableRuleIds = useMemo(
    () =>
      rules
        .filter((rule) => rule.linked_area_count === 0)
        .map((rule) => rule.id),
    [rules]
  );
  const deletableRuleCount = deletableRuleIds.length;
  const hasInUseRules = rules.length > deletableRuleCount;

  useEffect(() => {
    setSelectedRuleIds((current) => {
      if (rules.length === 0) {
        return new Set();
      }

      const validIds = new Set(
        rules
          .filter((rule) => rule.linked_area_count === 0)
          .map((rule) => rule.id)
      );
      return new Set(Array.from(current).filter((id) => validIds.has(id)));
    });
    setBulkDeleteDialogOpen(false);
  }, [rules]);

  const createPriceRuleMutation = useCreatePriceRuleMutation(
    selectedSpaceId ?? ''
  );
  const updatePriceRuleMutation = useUpdatePriceRuleMutation(
    selectedSpaceId ?? ''
  );
  const deletePriceRuleMutation = useDeletePriceRuleMutation(
    selectedSpaceId ?? ''
  );

  const handlePriceRuleDialogOpen = useCallback((rule?: PriceRuleRecord) => {
    setEditingPriceRule(rule ?? null);
    setPriceRuleDialogOpen(true);
  }, []);

  const handlePriceRuleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingPriceRule(null);
    }
    setPriceRuleDialogOpen(open);
  }, []);

  const handlePriceRuleSubmit = useCallback(
    async (values: PriceRuleFormValues) => {
      if (!selectedSpaceId) {
        toast.error('Select a space before saving a pricing rule.');
        return;
      }

      try {
        if (editingPriceRule) {
          await updatePriceRuleMutation.mutateAsync({
            priceRuleId: editingPriceRule.id,
            payload: values,
          });
          toast.success('Pricing rule updated.');
        } else {
          await createPriceRuleMutation.mutateAsync(values);
          toast.success('Pricing rule saved.');
        }
        setPriceRuleDialogOpen(false);
      } catch (mutationError) {
        toast.error(
          mutationError instanceof Error
            ? mutationError.message
            : 'Unable to save pricing rule.'
        );
      }
    },
    [
      createPriceRuleMutation,
      editingPriceRule,
      selectedSpaceId,
      updatePriceRuleMutation
    ]
  );

  const handleTestRule = useCallback(async () => {
    if (!testingRule || !selectedSpaceId) return;

    setIsTestingLoading(true);
    setTestError(null);
    setTestResult(null);

    try {
      const body: Record<string, unknown> = {
        definition: testingRule.definition,
        bookingHours: Number(testBookingHours) || 1,
      };
      const guestCountNum = Number(testGuestCount);
      if (guestCountNum > 0) body.guestCount = guestCountNum;
      if (testStartAt) body.startAt = new Date(testStartAt).toISOString();

      const response = await authFetch(
        `/api/v1/partner/spaces/${selectedSpaceId}/pricing-rules/evaluate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', },
          body: JSON.stringify(body),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        setTestError(typeof payload?.error === 'string' ? payload.error : 'Evaluation failed.');
        return;
      }

      setTestResult(payload.data);
    } catch {
      setTestError('Unable to evaluate pricing rule.');
    } finally {
      setIsTestingLoading(false);
    }
  }, [authFetch, selectedSpaceId, testBookingHours, testGuestCount, testStartAt, testingRule]);

  const handleOpenTestDialog = useCallback((rule: PriceRuleRecord) => {
    setTestingRule(rule);
    setTestBookingHours('1');
    setTestGuestCount('1');
    setTestStartAt('');
    setTestResult(null);
    setTestError(null);
  }, []);

  const selectedCount = rules.filter(
    (rule) => rule.linked_area_count === 0 && selectedRuleIds.has(rule.id)
  ).length;
  const selectionState: boolean | 'indeterminate' =
    deletableRuleCount > 0 && selectedCount === deletableRuleCount
      ? true
      : selectedCount > 0
        ? 'indeterminate'
        : false;

  const handleSelectRule = useCallback(
    (ruleId: string, checked: boolean) => {
      const rule = rules.find((entry) => entry.id === ruleId);
      if (!rule || rule.linked_area_count > 0) {
        return;
      }

      setSelectedRuleIds((current) => {
        const next = new Set(current);
        if (checked) {
          next.add(ruleId);
        } else {
          next.delete(ruleId);
        }
        return next;
      });
    },
    [rules]
  );

  const handleSelectAllRules = useCallback(
    (checked: boolean) => {
      setSelectedRuleIds((current) => {
        if (!checked) {
          const next = new Set(current);
          deletableRuleIds.forEach((id) => next.delete(id));
          return next;
        }

        return new Set(deletableRuleIds);
      });
    },
    [deletableRuleIds]
  );

  const clearRuleSelection = useCallback(() => {
    setSelectedRuleIds(new Set());
  }, []);

  const handleBulkDeletePriceRules = useCallback(async () => {
    if (!selectedSpaceId || selectedCount === 0) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        rules
          .filter((rule) => selectedRuleIds.has(rule.id) && rule.linked_area_count === 0)
          .map((rule) => deletePriceRuleMutation.mutateAsync(rule.id))
      );

      const succeededIds = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result) => result.value);
      const failed = results.length - succeededIds.length;
      const firstFailureReason = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      )?.reason;

      if (succeededIds.length > 0) {
        toast.success(
          `${succeededIds.length} pricing rule${succeededIds.length === 1 ? '' : 's'} deleted.`
        );
        setSelectedRuleIds((current) => {
          const next = new Set(current);
          succeededIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (failed > 0) {
        toast.error(
          firstFailureReason instanceof Error
            ? firstFailureReason.message
            : 'Some pricing rules could not be deleted. Please try again.'
        );
      } else {
        setBulkDeleteDialogOpen(false);
      }
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to delete selected pricing rules.'
      );
    } finally {
      setIsBulkDeleting(false);
    }
  }, [
    deletePriceRuleMutation,
    rules,
    selectedCount,
    selectedRuleIds,
    selectedSpaceId
  ]);

  const isAnyDeletePending = deletePriceRuleMutation.isPending || isBulkDeleting;

  const formatRuleTimestamp = (rule: PriceRuleRecord) => {
    const timestamp = rule.updated_at ?? rule.created_at;
    if (!timestamp) {
      return '—';
    }
    return priceRuleDateFormatter.format(new Date(timestamp));
  };

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
      <SpacesBreadcrumbs
        currentPage="Price Rules"
        className="mt-6 mb-4 sm:mb-6"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Pricing rules
          </h1>
          <p className="text-sm text-muted-foreground md:text-base max-w-2xl">
            Draft modular pricing logic once and reuse it across your spaces.
            Pick a space to review existing rules or add a new one below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="default"
            onClick={ () => router.push('/partner/spaces/pricing-rules/new') }
            disabled={ !selectedSpaceId }
            className="hover:text-white"
          >
            <FiPlus className="size-4" aria-hidden="true" />
            New rule
          </Button>
        </div>
      </div>

      { isError ? (
        <Card className="mt-6 border-dashed border-border/60 bg-destructive/5 text-destructive">
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Unable to load pricing rules.</p>
              <p className="text-xs text-destructive/80">
                { error instanceof Error ? error.message : 'Try refreshing the page.' }
              </p>
            </div>
            <Button type="button" variant="outline" onClick={ () => refetch() } className="self-start sm:self-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
          ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Rules for</h2>
              { isLoading ? (
                <Skeleton className="h-10 w-44 rounded-md" />
              ) : spaces && spaces.length ? (
                <Select
                  value={ selectedSpaceId ?? undefined }
                  onValueChange={ (value) => setSelectedSpaceId(value) }
                >
                  <SelectTrigger className="min-w-[14rem] text-left" aria-label="Select space">
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
                <p className="text-sm text-muted-foreground">No spaces available. Add a space to manage pricing rules.</p>
              ) }
            </div>
            { selectedSpace ? (
              <Button
                variant="link"
                asChild
                className="px-0 text-sm font-semibold text-secondary hover:text-secondary/80"
              >
                <Link
                  href={ `/spaces/${selectedSpace.id}` }
                  className="inline-flex items-center gap-2"
                >
                  View Space
                  <GoArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null }
          </div>

          <div className="space-y-3">
            { selectedCount > 0 ? (
              <div className="flex flex-wrap items-center justify-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={ clearRuleSelection }
                  disabled={ isAnyDeletePending }
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={ () => setBulkDeleteDialogOpen(true) }
                  disabled={ !selectedSpace || isAnyDeletePending || isLoading }
                >
                  <FiTrash2 className="size-4" aria-hidden="true" />
                  { isBulkDeleting ? 'Deleting...' : 'Delete selected' }
                </Button>
              </div>
            ) : null }
            { hasInUseRules ? (
              <p className="text-xs text-muted-foreground">
                Pricing rules that are in use by areas cannot be deleted. Detach them from all areas in this space first.
              </p>
            ) : null }
            { isLoading ? (
              <div className="rounded-md border border-border/60">
                <Table>
                  <TableCaption className="sr-only">
                    Pricing rules table with selection controls
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </TableHead>
                      <TableHead>Name &amp; description</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    { Array.from({ length: 3, }).map((_, index) => (
                      <TableRow key={ `pricing-rule-skeleton-${index}` }>
                        <TableCell>
                          <Skeleton className="h-4 w-4 rounded-sm" />
                        </TableCell>
                        <TableCell className="min-w-[240px]">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-64" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-16 rounded-md" />
                          </div>
                        </TableCell>
                      </TableRow>
                    )) }
                  </TableBody>
                </Table>
              </div>
            ) : !selectedSpace ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                No spaces available. Add a space to manage pricing rules.
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                No pricing rules for this space. Click &quot;New rule&quot; to
                get started.
              </div>
            ) : (
              <div className="rounded-md border border-border/60">
                <Table>
                  <TableCaption className="sr-only">
                    Pricing rules with per-row selection for bulk deletion
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10">
                        <Checkbox
                          aria-label="Select all pricing rules"
                          checked={ selectionState }
                          disabled={ deletableRuleCount === 0 || isAnyDeletePending }
                          onCheckedChange={ (checked) => handleSelectAllRules(Boolean(checked)) }
                        />
                      </TableHead>
                      <TableHead>Name &amp; description</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    { rules.map((rule) => {
                      const isSelected = selectedRuleIds.has(rule.id);
                      const isDeletable = rule.linked_area_count === 0;

                      return (
                        <TableRow
                          key={ rule.id }
                          data-state={ isSelected ? 'selected' : undefined }
                        >
                          <TableCell>
                            <Checkbox
                              aria-label={ `Select pricing rule ${rule.name}` }
                              checked={ isSelected }
                              disabled={ !isDeletable || isAnyDeletePending }
                              onCheckedChange={ (checked) => handleSelectRule(rule.id, Boolean(checked)) }
                            />
                          </TableCell>
                          <TableCell className="min-w-[240px]">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold leading-tight">
                                { rule.name }
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                { rule.description?.trim()
                                  ? rule.description
                                  : 'No description provided.' }
                              </p>
                              { rule.linked_area_count > 0 ? (
                                <p className="text-xs text-amber-600">
                                  In use by { rule.linked_area_count } area{ rule.linked_area_count === 1 ? '' : 's' } in this space.
                                </p>
                              ) : null }
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              { rule.definition.conditions.length }
                              <span className="text-[11px] uppercase text-muted-foreground">
                                conditions
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            { formatRuleTimestamp(rule) }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={ () => handleOpenTestDialog(rule) }
                                disabled={ isAnyDeletePending }
                              >
                                <FiPlay className="size-4" aria-hidden="true" />
                                Test
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="hover:text-white"
                                onClick={ () => handlePriceRuleDialogOpen(rule) }
                                disabled={ isAnyDeletePending }
                              >
                                <FiEdit className="size-4" aria-hidden="true" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) }
                  </TableBody>
                </Table>
              </div>
            ) }
          </div>
        </div>
      ) }

      { priceRuleDialogOpen && (
        <PriceRuleDialog
          open={ priceRuleDialogOpen }
          mode={ editingPriceRule ? 'edit' : 'create' }
          initialValues={
            editingPriceRule
              ? {
                  name: editingPriceRule.name,
                  description: editingPriceRule.description ?? '',
                  definition: editingPriceRule.definition,
                }
              : undefined
          }
          onOpenChange={ handlePriceRuleDialogOpenChange }
          onSubmit={ handlePriceRuleSubmit }
          isSubmitting={
            createPriceRuleMutation.isPending || updatePriceRuleMutation.isPending
          }
        />
      ) }

      <Dialog
        open={ testingRule !== null }
        onOpenChange={ (open) => {
          if (!open) setTestingRule(null);
        } }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test pricing rule</DialogTitle>
            <DialogDescription>
              { testingRule?.name ? `Evaluate "${testingRule.name}" with sample inputs.` : 'Evaluate a pricing rule with sample inputs.' }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-booking-hours">Booking hours</Label>
              <Input
                id="test-booking-hours"
                type="number"
                min={ 1 }
                max={ 24 }
                value={ testBookingHours }
                onChange={ (e) => setTestBookingHours(e.target.value) }
                aria-label="Booking hours"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-guest-count">Guest count</Label>
              <Input
                id="test-guest-count"
                type="number"
                min={ 1 }
                max={ 999 }
                value={ testGuestCount }
                onChange={ (e) => setTestGuestCount(e.target.value) }
                aria-label="Guest count"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-start-at">Start time (optional)</Label>
              <Input
                id="test-start-at"
                type="datetime-local"
                value={ testStartAt }
                onChange={ (e) => setTestStartAt(e.target.value) }
                aria-label="Booking start time"
              />
            </div>

            { testError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                { testError }
              </div>
            ) : null }

            { testResult ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total price</span>
                  <span className="text-lg font-semibold text-foreground">
                    { testResult.price !== null ? `₱${testResult.price.toLocaleString()}` : '—' }
                  </span>
                </div>
                { testResult.unitPrice !== null && testResult.guestMultiplierApplied ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Unit price (per guest)</span>
                    <span className="text-sm text-foreground">₱{ testResult.unitPrice.toLocaleString() }</span>
                  </div>
                ) : null }
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Branch</span>
                  <Badge variant="outline" className="text-xs">{ testResult.branch ?? 'unconditional' }</Badge>
                </div>
                { testResult.appliedExpression ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Expression</span>
                    <code className="text-xs text-foreground">{ testResult.appliedExpression }</code>
                  </div>
                ) : null }
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Conditions met</span>
                  <Badge variant={ testResult.conditionsSatisfied ? 'success' : 'secondary' } className="text-xs">
                    { testResult.conditionsSatisfied ? 'Yes' : 'No' }
                  </Badge>
                </div>
              </div>
            ) : null }
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={ () => setTestingRule(null) }
            >
              Close
            </Button>
            <Button
              type="button"
              variant="default"
              className="hover:text-white"
              onClick={ handleTestRule }
              disabled={ isTestingLoading }
            >
              { isTestingLoading ? (
                <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FiPlay className="mr-2 size-4" aria-hidden="true" />
              ) }
              Evaluate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ bulkDeleteDialogOpen }
        onOpenChange={ (open) => {
          if (!open) {
            setBulkDeleteDialogOpen(false);
          }
        } }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected pricing rules</DialogTitle>
            <DialogDescription>
              { selectedCount === 0
                ? 'Choose at least one rule to delete.'
                : `This will remove ${selectedCount} pricing rule${selectedCount === 1 ? '' : 's'} from ${selectedSpace?.name ?? 'this space'}. Areas linked to them will lose their pricing logic.` }
            </DialogDescription>
          </DialogHeader>
          { selectedCount > 0 ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">Selected rules</p>
              <ul className="list-disc space-y-1 pl-5">
                { rules
                  .filter((rule) => selectedRuleIds.has(rule.id))
                  .slice(0, 4)
                  .map((rule) => (
                    <li key={ rule.id }>{ rule.name }</li>
                  )) }
                { selectedCount > 4 ? (
                  <li className="text-muted-foreground">
                    +{ selectedCount - 4 } more
                  </li>
                ) : null }
              </ul>
            </div>
          ) : null }
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={ () => setBulkDeleteDialogOpen(false) }
              disabled={ isAnyDeletePending }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={ handleBulkDeletePriceRules }
              disabled={ isAnyDeletePending || selectedCount === 0 }
            >
              { isAnyDeletePending ? 'Deleting...' : 'Delete selected' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
