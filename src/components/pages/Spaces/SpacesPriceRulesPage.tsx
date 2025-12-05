"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit, FiPlus, FiTrash2 } from "react-icons/fi";
import { toast } from "sonner";

import PriceRuleDialog from "./PriceRuleDialog";
import { SpacesBreadcrumbs } from "./SpacesBreadcrumbs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreatePriceRuleMutation,
  useDeletePriceRuleMutation,
  usePartnerSpacesQuery,
  useUpdatePriceRuleMutation,
} from "@/hooks/api/usePartnerSpaces";
import type { PriceRuleFormValues, PriceRuleRecord } from "@/lib/pricing-rules";

const priceRuleDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function SpacesPriceRulesPage() {
  const { data: spaces, isError, isLoading, error } = usePartnerSpacesQuery();

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
    [selectedSpaceId, spaces],
  );

  useEffect(() => {
    setSelectedRuleIds((current) => {
      if (!selectedSpace) {
        return new Set();
      }

      const validIds = new Set(selectedSpace.pricing_rules.map((rule) => rule.id));
      return new Set(Array.from(current).filter((id) => validIds.has(id)));
    });
    setBulkDeleteDialogOpen(false);
  }, [selectedSpace]);

  const createPriceRuleMutation = useCreatePriceRuleMutation(
    selectedSpaceId ?? "",
  );
  const updatePriceRuleMutation = useUpdatePriceRuleMutation(
    selectedSpaceId ?? "",
  );
  const deletePriceRuleMutation = useDeletePriceRuleMutation(
    selectedSpaceId ?? "",
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
        toast.error("Select a space before saving a pricing rule.");
        return;
      }

      try {
        if (editingPriceRule) {
          await updatePriceRuleMutation.mutateAsync({
            priceRuleId: editingPriceRule.id,
            payload: values,
          });
          toast.success("Pricing rule updated.");
        } else {
          await createPriceRuleMutation.mutateAsync(values);
          toast.success("Pricing rule saved.");
        }
        setPriceRuleDialogOpen(false);
      } catch (mutationError) {
        toast.error(
          mutationError instanceof Error
            ? mutationError.message
            : "Unable to save pricing rule.",
        );
      }
    },
    [
      createPriceRuleMutation,
      editingPriceRule,
      selectedSpaceId,
      updatePriceRuleMutation,
    ],
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
          : "Unable to delete pricing rule.",
      );
    }
  }, [deletePriceRuleMutation, priceRulePendingDelete, selectedSpaceId]);

  const rules = selectedSpace?.pricing_rules ?? [];

  const selectedCount = rules.filter((rule) => selectedRuleIds.has(rule.id)).length;
  const selectionState: boolean | "indeterminate" =
    selectedCount === rules.length && rules.length > 0
      ? true
      : selectedCount > 0
        ? "indeterminate"
        : false;

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
    [rules],
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
          .map((rule) => deletePriceRuleMutation.mutateAsync(rule.id)),
      );

      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.length - succeeded;

      if (succeeded > 0) {
        toast.success(
          `${succeeded} pricing rule${succeeded === 1 ? "" : "s"} deleted.`,
        );
        clearRuleSelection();
      }

      if (failed > 0) {
        toast.error("Some pricing rules could not be deleted. Please try again.");
      }

      setBulkDeleteDialogOpen(false);
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to delete selected pricing rules.",
      );
    } finally {
      setIsBulkDeleting(false);
    }
  }, [
    clearRuleSelection,
    deletePriceRuleMutation,
    rules,
    selectedCount,
    selectedRuleIds,
    selectedSpaceId,
  ]);

  const formatRuleTimestamp = (rule: PriceRuleRecord) => {
    const timestamp = rule.updated_at ?? rule.created_at;
    if (!timestamp) {
      return "—";
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
            onClick={() => router.push("/spaces/pricing-rules/new")}
            disabled={!selectedSpaceId}
          >
            <FiPlus className="size-4" aria-hidden="true" />
            New rule
          </Button>
        </div>
      </div>

      {isError ? (
        <Card className="mt-6 border-dashed border-border/60 bg-destructive/5 text-destructive">
          <CardContent>
            <p className="text-sm font-medium">Unable to load pricing rules.</p>
            <p className="text-xs text-destructive/80">
              {error instanceof Error
                ? error.message
                : "Try refreshing the page."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-border/70 bg-background/80">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">
                Rules for {selectedSpace ? selectedSpace.name : "—"}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {selectedSpace ? (
                  <Link
                    href={`/spaces/${selectedSpace.id}`}
                    className="inline-flex items-center text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View space
                  </Link>
                ) : (
                  "Choose a space to see its pricing rules."
                )}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name &amp; description</TableHead>
                      <TableHead>Variables</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={`pricing-rule-skeleton-${index}`}>
                        <TableCell>
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
                    ))}
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
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name &amp; description</TableHead>
                      <TableHead>Variables</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="min-w-[240px]">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold leading-tight">
                              {rule.name}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {rule.description?.trim()
                                ? rule.description
                                : "No description provided."}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            {rule.definition.variables.length}
                            <span className="text-[11px] uppercase text-muted-foreground">
                              vars
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {rule.definition.conditions.length}
                            <span className="text-[11px] uppercase text-muted-foreground">
                              conditions
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRuleTimestamp(rule)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handlePriceRuleDialogOpen(rule)}
                            >
                              <FiEdit className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setPriceRulePendingDelete(rule)}
                            >
                              <FiTrash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PriceRuleDialog
        open={priceRuleDialogOpen}
        mode={editingPriceRule ? "edit" : "create"}
        initialValues={
          editingPriceRule
            ? {
                name: editingPriceRule.name,
                description: editingPriceRule.description ?? "",
                definition: editingPriceRule.definition,
              }
            : undefined
        }
        onOpenChange={handlePriceRuleDialogOpenChange}
        onSubmit={handlePriceRuleSubmit}
        isSubmitting={
          createPriceRuleMutation.isPending || updatePriceRuleMutation.isPending
        }
      />

      <Dialog
        open={Boolean(priceRulePendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPriceRulePendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete pricing rule</DialogTitle>
            <DialogDescription>
              Deleting {priceRulePendingDelete?.name ?? "this rule"} will unlink
              it from any areas that use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPriceRulePendingDelete(null)}
              disabled={deletePriceRuleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeletePriceRule}
              disabled={deletePriceRuleMutation.isPending}
            >
              {deletePriceRuleMutation.isPending
                ? "Deleting..."
                : "Delete rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
