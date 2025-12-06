'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { FiEdit, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';

import PriceRuleDialog from './PriceRuleDialog';
import { SpacesBreadcrumbs } from './SpacesBreadcrumbs';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [priceRulePendingDelete, setPriceRulePendingDelete] =
    useState<PriceRuleRecord | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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

  useEffect(() => {
    setSelectedRuleIds((current) => {
      if (rules.length === 0) {
        return new Set();
      }

      const validIds = new Set(rules.map((rule) => rule.id));
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

  const handleConfirmDeletePriceRule = useCallback(async () => {
    if (!selectedSpaceId || !priceRulePendingDelete) {
      return;
    }

    try {
      await deletePriceRuleMutation.mutateAsync(priceRulePendingDelete.id);
      toast.success(`${priceRulePendingDelete.name} removed.`);
      setPriceRulePendingDelete(null);
      setSelectedRuleIds((current) => {
        const next = new Set(current);
        next.delete(priceRulePendingDelete.id);
        return next;
      });
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to delete pricing rule.'
      );
    }
  }, [deletePriceRuleMutation, priceRulePendingDelete, selectedSpaceId]);

  const selectedCount = rules.filter((rule) => selectedRuleIds.has(rule.id)).length;
  const selectionState: boolean | 'indeterminate' =
    selectedCount === rules.length && rules.length > 0
      ? true
      : selectedCount > 0
        ? 'indeterminate'
        : false;
  const ruleCountLabel = `${rules.length} rule${rules.length === 1 ? '' : 's'}`;

  const handleSelectRule = useCallback((ruleId: string, checked: boolean) => {
    setSelectedRuleIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(ruleId);
      } else {
        next.delete(ruleId);
      }
      return next;
    });
  }, []);

  const handleSelectAllRules = useCallback(
    (checked: boolean) => {
      setSelectedRuleIds((current) => {
        if (!checked) {
          const next = new Set(current);
          rules.forEach((rule) => next.delete(rule.id));
          return next;
        }

        return new Set(rules.map((rule) => rule.id));
      });
    },
    [rules]
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
          .filter((rule) => selectedRuleIds.has(rule.id))
          .map((rule) => deletePriceRuleMutation.mutateAsync(rule.id))
      );

      const succeededIds = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result) => result.value);
      const failed = results.length - succeededIds.length;

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
        toast.error('Some pricing rules could not be deleted. Please try again.');
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
            variant="outline"
            onClick={ () => router.push('/spaces/pricing-rules/new') }
            disabled={ !selectedSpaceId }
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
        <Card className="mt-6 border-border/70 bg-background/80">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Rules for { selectedSpace ? selectedSpace.name : '—' }
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                { selectedSpace ? (
                  <Link
                    href={ `/spaces/${selectedSpace.id}` }
                    className="text-xs text-secondary underline-offset-4 hover:underline"
                  >
                    View space
                  </Link>
                ) : (
                  'Choose a space to see its pricing rules.'
                ) }
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            { selectedCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    { ruleCountLabel }
                  </Badge>
                  <Badge variant="default" className="text-xs">
                    { selectedCount } selected
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
              </div>
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
                      <TableHead>Variables</TableHead>
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
                          <Skeleton className="h-6 w-14 rounded-full" />
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
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          aria-label="Select all pricing rules"
                          checked={ selectionState }
                          onCheckedChange={ (checked) => handleSelectAllRules(Boolean(checked)) }
                        />
                      </TableHead>
                      <TableHead>Name &amp; description</TableHead>
                      <TableHead>Variables</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    { rules.map((rule) => {
                      const isSelected = selectedRuleIds.has(rule.id);

                      return (
                        <TableRow
                          key={ rule.id }
                          data-state={ isSelected ? 'selected' : undefined }
                        >
                          <TableCell>
                            <Checkbox
                              aria-label={ `Select pricing rule ${rule.name}` }
                              checked={ isSelected }
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
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="gap-1">
                              { rule.definition.variables.length }
                              <span className="text-[11px] uppercase text-muted-foreground">
                                vars
                              </span>
                            </Badge>
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
                                onClick={ () => handlePriceRuleDialogOpen(rule) }
                                disabled={ isAnyDeletePending }
                              >
                                <FiEdit className="size-4" aria-hidden="true" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={ () => setPriceRulePendingDelete(rule) }
                                disabled={ isAnyDeletePending }
                              >
                                <FiTrash2 className="size-4" aria-hidden="true" />
                                Delete
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
          </CardContent>
        </Card>
      ) }

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

      <Dialog
        open={ Boolean(priceRulePendingDelete) }
        onOpenChange={ (open) => {
          if (!open) {
            setPriceRulePendingDelete(null);
          }
        } }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete pricing rule</DialogTitle>
            <DialogDescription>
              Deleting { priceRulePendingDelete?.name ?? 'this rule' } will unlink
              it from any areas that use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={ () => setPriceRulePendingDelete(null) }
              disabled={ isAnyDeletePending }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={ handleConfirmDeletePriceRule }
              disabled={ isAnyDeletePending }
            >
              { isAnyDeletePending
                ? 'Deleting...'
                : 'Delete rule' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
