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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreatePriceRuleMutation,
  useDeletePriceRuleMutation,
  usePartnerSpacesQuery,
  useUpdatePriceRuleMutation
} from '@/hooks/api/usePartnerSpaces';
import type { PriceRuleFormValues, PriceRuleRecord } from '@/lib/pricing-rules';

export function SpacesPriceRulesPage() {
  const {
    data: spaces,
    isError,
    isLoading,
    error,
  } = usePartnerSpacesQuery();

  const router = useRouter();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [priceRuleDialogOpen, setPriceRuleDialogOpen] = useState(false);
  const [editingPriceRule, setEditingPriceRule] = useState<PriceRuleRecord | null>(null);
  const [priceRulePendingDelete, setPriceRulePendingDelete] = useState<PriceRuleRecord | null>(null);

  useEffect(() => {
    if (!selectedSpaceId && spaces?.length) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [selectedSpaceId, spaces]);

  const selectedSpace = useMemo(
    () => spaces?.find((space) => space.id === selectedSpaceId) ?? null,
    [selectedSpaceId, spaces]
  );

  const createPriceRuleMutation = useCreatePriceRuleMutation(selectedSpaceId ?? '');
  const updatePriceRuleMutation = useUpdatePriceRuleMutation(selectedSpaceId ?? '');
  const deletePriceRuleMutation = useDeletePriceRuleMutation(selectedSpaceId ?? '');

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

  const handlePriceRuleSubmit = useCallback(async (values: PriceRuleFormValues) => {
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
  }, [
    createPriceRuleMutation,
    editingPriceRule,
    selectedSpaceId,
    updatePriceRuleMutation
  ]);

  const handleConfirmDeletePriceRule = useCallback(async () => {
    if (!selectedSpaceId || !priceRulePendingDelete) {
      return;
    }

    try {
      await deletePriceRuleMutation.mutateAsync(priceRulePendingDelete.id);
      toast.success(`${priceRulePendingDelete.name} removed.`);
      setPriceRulePendingDelete(null);
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to delete pricing rule.'
      );
    }
  }, [deletePriceRuleMutation, priceRulePendingDelete, selectedSpaceId]);

  const rules = selectedSpace?.pricing_rules ?? [];

  const ruleCountLabel = `${rules.length} rule${rules.length === 1 ? '' : 's'}`;

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-10">
      <SpacesBreadcrumbs currentPage="Price Rules" className="mt-6 mb-4 sm:mb-6" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Pricing rules
          </h1>
          <p className="text-sm text-muted-foreground md:text-base max-w-2xl">
            Draft modular pricing logic once and reuse it across your spaces. Pick a space to
            review existing rules or add a new one below.
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
          <CardContent>
            <p className="text-sm font-medium">Unable to load pricing rules.</p>
            <p className="text-xs text-destructive/80">{ error instanceof Error ? error.message : 'Try refreshing the page.' }</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-border/70 bg-background/80">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Rules for { selectedSpace ? selectedSpace.name : '—' }</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                { selectedSpace ? (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <Badge variant="secondary">{ ruleCountLabel }</Badge>
                      <Badge variant="outline">{ selectedSpace.status }</Badge>
                      <Link href={ `/spaces/${selectedSpace.id}` } className="text-xs text-primary underline-offset-4 hover:underline">
                        View space
                      </Link>
                    </span>
                  </>
                ) : 'Choose a space to see its pricing rules.' }
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            { isLoading ? (
              <div className="space-y-3">
                { Array.from({ length: 3, }).map((_, index) => (
                  <Skeleton key={ `pricing-rule-skeleton-${index}` } className="h-20 rounded-lg" />
                )) }
              </div>
            ) : !selectedSpace ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                No spaces available. Add a space to manage pricing rules.
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                No pricing rules for this space. Click &quot;New rule&quot; to get started.
              </div>
            ) : (
              <div className="space-y-3">
                { rules.map((rule) => (
                  <div key={ rule.id } className="rounded-md border border-border/60 p-3 md:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold font-sf">{ rule.name }</p>
                        <p className="text-[11px] text-muted-foreground font-sf">
                          { rule.description ?? 'No description provided.' }
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          { rule.definition.conditions.length } condition{ rule.definition.conditions.length === 1 ? '' : 's' }
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={ () => handlePriceRuleDialogOpen(rule) }
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
                        >
                          <FiTrash2 className="size-4" aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )) }
              </div>
            ) }
          </CardContent>
        </Card>
      ) }

      <PriceRuleDialog
        open={ priceRuleDialogOpen }
        mode={ editingPriceRule ? 'edit' : 'create' }
        initialValues={ editingPriceRule ? {
          name: editingPriceRule.name,
          description: editingPriceRule.description ?? '',
          definition: editingPriceRule.definition,
        } : undefined }
        onOpenChange={ handlePriceRuleDialogOpenChange }
        onSubmit={ handlePriceRuleSubmit }
        isSubmitting={ createPriceRuleMutation.isPending || updatePriceRuleMutation.isPending }
      />

      <Dialog open={ Boolean(priceRulePendingDelete) } onOpenChange={ (open) => {
        if (!open) {
          setPriceRulePendingDelete(null);
        }
      } }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete pricing rule</DialogTitle>
            <DialogDescription>
              Deleting { priceRulePendingDelete?.name ?? 'this rule' } will unlink it from any areas that use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={ () => setPriceRulePendingDelete(null) }
              disabled={ deletePriceRuleMutation.isPending }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={ handleConfirmDeletePriceRule }
              disabled={ deletePriceRuleMutation.isPending }
            >
              { deletePriceRuleMutation.isPending ? 'Deleting...' : 'Delete rule' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
