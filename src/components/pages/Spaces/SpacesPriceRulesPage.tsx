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

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreatePriceRuleMutation,
  useDeletePriceRuleMutation,
  usePartnerSpacesQuery,
  useUpdatePriceRuleMutation
} from '@/hooks/api/usePartnerSpaces';
import type { PriceRuleFormValues, PriceRuleRecord } from '@/lib/pricing-rules';

type AdvanceBookingUnit = 'days' | 'weeks' | 'months';

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
  const [automaticBookingEnabled, setAutomaticBookingEnabled] = useState(false);
  const [maxCapacity, setMaxCapacity] = useState<string>('');
  const [requireApprovalAtCapacity, setRequireApprovalAtCapacity] = useState(false);
  const [selectedPricingRuleId, setSelectedPricingRuleId] = useState<string>('');
  const [advanceBookingEnabled, setAdvanceBookingEnabled] = useState(false);
  const [advanceBookingWindow, setAdvanceBookingWindow] = useState<string>('');
  const [advanceBookingUnit, setAdvanceBookingUnit] = useState<AdvanceBookingUnit>('days');
  const [bookingNotesEnabled, setBookingNotesEnabled] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');

  useEffect(() => {
    if (!selectedSpaceId && spaces?.length) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [selectedSpaceId, spaces]);

  useEffect(() => {
    setAutomaticBookingEnabled(false);
    setMaxCapacity('');
    setRequireApprovalAtCapacity(false);
    setSelectedPricingRuleId('');
    setAdvanceBookingEnabled(false);
    setAdvanceBookingWindow('');
    setAdvanceBookingUnit('days');
    setBookingNotesEnabled(false);
    setBookingNotes('');
  }, [selectedSpaceId]);

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

      <Card className="mt-6 border-border/70 bg-background/80">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Area interface</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Configure how bookings flow for this space: approval rules, capacity limits, and optional notes customers will see.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Allow automatic booking</p>
                <p className="text-xs text-muted-foreground">
                  Default off. When disabled, all bookings require manual approval by the partner.
                </p>
              </div>
              <Switch
                id="automatic-booking"
                checked={ automaticBookingEnabled }
                onCheckedChange={ setAutomaticBookingEnabled }
                aria-label="Allow automatic booking"
              />
            </div>
            { automaticBookingEnabled ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="max-capacity" className="text-sm font-medium text-foreground">
                      Maximum capacity
                    </Label>
                    <span className="text-[11px] font-medium text-muted-foreground">Required</span>
                  </div>
                  <Input
                    id="max-capacity"
                    type="number"
                    min={ 1 }
                    required
                    aria-required="true"
                    aria-label="Maximum automatic booking capacity"
                    placeholder="Enter maximum capacity"
                    value={ maxCapacity }
                    onChange={ (event) => setMaxCapacity(event.target.value) }
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-approve bookings until this limit. Above the limit, switch to approval or stop bookings.
                  </p>
                </div>
                <div className="flex h-full flex-col justify-between rounded-lg border border-border/70 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="request-approval-capacity" className="text-sm font-medium text-foreground">
                        Request approval when maximum capacity is reached
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Keep accepting requests but require approvals after the limit.
                      </p>
                    </div>
                    <Switch
                      id="request-approval-capacity"
                      checked={ requireApprovalAtCapacity }
                      onCheckedChange={ setRequireApprovalAtCapacity }
                      aria-label="Request approval when maximum capacity is reached"
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    { requireApprovalAtCapacity
                      ? 'After the cap, bookings stay open but revert to manual approvals.'
                      : 'Turn off to stop accepting bookings entirely once the capacity is full.' }
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                Maximum capacity and approval fallbacks appear once automatic booking is enabled.
              </div>
            ) }
          </div>

          <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
            <p className="mb-2 text-[13px] font-semibold text-foreground">Booking approval logic</p>
            <ul className="space-y-1 pl-4 list-disc">
              <li>Automatic booking off (default): all bookings require manual approval; capacity settings stay hidden.</li>
              <li>Automatic booking on + request approval at capacity: bookings auto-approve until the limit, then revert to manual approvals.</li>
              <li>Automatic booking on + request approval off: bookings auto-approve until the limit, then new bookings are blocked as fully booked.</li>
            </ul>
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 bg-background/70 p-4">
            <Label htmlFor="pricing-rule-select" className="text-sm font-medium text-foreground">
              Pricing rule
            </Label>
            <Select
              value={ selectedPricingRuleId }
              onValueChange={ setSelectedPricingRuleId }
              disabled={ rules.length === 0 }
            >
              <SelectTrigger id="pricing-rule-select" className="w-full" aria-label="Select pricing rule">
                <SelectValue placeholder={ rules.length ? 'Select pricing rule' : 'No pricing rules available' } />
              </SelectTrigger>
              <SelectContent>
                { rules.length ? (
                  rules.map((rule) => (
                    <SelectItem key={ rule.id } value={ rule.id }>
                      { rule.name }
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-pricing-rules" disabled>
                    No pricing rules available for this space
                  </SelectItem>
                ) }
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lists available pricing rules for this space. Assign a rule to adjust base rates automatically.
            </p>
          </div>

          <Accordion type="single" collapsible defaultValue="advanced-options">
            <AccordionItem value="advanced-options" className="border-border/70">
              <AccordionTrigger className="text-sm font-semibold">Advanced options</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Allow advance booking</p>
                      <p className="text-xs text-muted-foreground">
                        Default: customers can only book hours in advance (same-day).
                      </p>
                    </div>
                    <Switch
                      id="advance-booking"
                      checked={ advanceBookingEnabled }
                      onCheckedChange={ setAdvanceBookingEnabled }
                      aria-label="Allow advance booking"
                    />
                  </div>
                  { advanceBookingEnabled ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/20 p-3">
                      <p className="text-sm text-foreground">Allow bookings up to</p>
                      <Input
                        id="advance-booking-window"
                        type="number"
                        min={ 1 }
                        aria-label="Advance booking window"
                        className="w-24"
                        placeholder="30"
                        value={ advanceBookingWindow }
                        onChange={ (event) => setAdvanceBookingWindow(event.target.value) }
                      />
                      <Select
                        value={ advanceBookingUnit }
                        onValueChange={ (value: AdvanceBookingUnit) => setAdvanceBookingUnit(value) }
                      >
                        <SelectTrigger id="advance-booking-unit" aria-label="Advance booking unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-foreground">in advance</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Customers can only book hours in advance by default. Enable to set a window in days, weeks, or months.
                    </p>
                  ) }
                </div>

                <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Enable booking notes</p>
                      <p className="text-xs text-muted-foreground">
                        Share arrival instructions or expectations; notes will appear in the customer booking interface.
                      </p>
                    </div>
                    <Switch
                      id="booking-notes"
                      checked={ bookingNotesEnabled }
                      onCheckedChange={ setBookingNotesEnabled }
                      aria-label="Enable booking notes"
                    />
                  </div>
                  { bookingNotesEnabled ? (
                    <Textarea
                      aria-label="Booking notes for customers"
                      placeholder="Example: Please check in at the front desk and present your ID."
                      value={ bookingNotes }
                      onChange={ (event) => setBookingNotes(event.target.value) }
                      rows={ 4 }
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Turn on booking notes to add messaging customers will see before confirming.
                    </p>
                  ) }
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

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
