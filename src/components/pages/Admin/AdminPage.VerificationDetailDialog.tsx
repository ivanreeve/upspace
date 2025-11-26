'use client';

import { useState } from 'react';
import {
  FiCalendar,
  FiCheck,
  FiExternalLink,
  FiFileText,
  FiX
} from 'react-icons/fi';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useApproveVerificationMutation, useRejectVerificationMutation, type PendingVerification } from '@/hooks/api/useAdminVerifications';
import { useCachedAvatar } from '@/hooks/use-cached-avatar';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';

type Props = {
  verification: PendingVerification | null;
  open: boolean;
  onClose: () => void;
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  dti_registration: 'DTI Registration',
  sec_registration: 'SEC Registration',
  bir_cor: 'BIR Certificate of Registration',
  authorized_rep_id: 'Authorized Representative ID',
  business_permit: 'Business Permit',
  business_address_proof: 'Business Address Proof',
  occupancy_permit: 'Occupancy Permit',
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('');

export function VerificationDetailDialog({
  verification,
  open,
  onClose,
}: Props) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [validUntil, setValidUntil] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [draftValidUntil, setDraftValidUntil] = useState('');
  const [showValidityModal, setShowValidityModal] = useState(false);
  const partnerAvatarUrl = useCachedAvatar(verification?.space.partner.avatar_url ?? null);
  const partnerInitials = getInitials(
    verification?.space.partner.name ?? verification?.space.partner.handle ?? ''
  );

  const approveMutation = useApproveVerificationMutation();
  const rejectMutation = useRejectVerificationMutation();

  const resetDialogState = () => {
    setShowRejectForm(false);
    setRejectionReason('');
    setValidUntil('');
    setIsIndefinite(false);
    setDraftValidUntil('');
    setShowValidityModal(false);
  };

  const handleApprove = async (overrideValidUntil?: string) => {
    if (!verification) return;
    const expiryDate = isIndefinite ? null : overrideValidUntil ?? validUntil;
    if (!isIndefinite && !expiryDate) {
      toast.error('Please choose a validity end date or mark the approval as indefinite before approving.');
      return;
    }
    try {
      await approveMutation.mutateAsync({
        verificationId: verification.id,
        validUntil: expiryDate,
      });
      toast.success('Space approved successfully');
      resetDialogState();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve verification');
    }
  };

  const handleReject = async () => {
    if (!verification || !rejectionReason.trim()) return;
    try {
      await rejectMutation.mutateAsync({
        verificationId: verification.id,
        reason: rejectionReason.trim(),
      });
      toast.success('Space verification rejected');
      setRejectionReason('');
      setShowRejectForm(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject verification');
    }
  };

  const formatDateForInput = (date: Date) => format(date, 'yyyy-MM-dd');

  const handleApproveClick = () => {
    const todayIso = formatDateForInput(new Date());
    setDraftValidUntil(validUntil || todayIso);
    setShowValidityModal(true);
  };

  const toggleIndefiniteInModal = (next: boolean) => {
    setIsIndefinite(next);
    if (next) {
      setDraftValidUntil('');
    } else {
      setDraftValidUntil(validUntil || formatDateForInput(new Date()));
    }
  };

  const handleValidityConfirm = async () => {
    if (isIndefinite) {
      setShowValidityModal(false);
      await handleApprove();
      return;
    }
    if (!draftValidUntil) {
      toast.error('Please select a validity end date before approving.');
      return;
    }
    setShowValidityModal(false);
    setValidUntil(draftValidUntil);
    await handleApprove(draftValidUntil);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetDialogState();
      onClose();
    }
  };

  if (!verification) return null;

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;
  const formattedValidUntil =
    validUntil && !Number.isNaN(Date.parse(validUntil))
      ? format(new Date(validUntil), 'PPP')
      : '';
  const today = new Date();
  const calendarYearRange = {
    fromYear: today.getFullYear(),
    toYear: today.getFullYear() + 10,
  };
  const validityButtonLabel =
    isIndefinite ? 'Indefinite' : formattedValidUntil || 'Select date';

  return (
    <>
      <Dialog open={ open } onOpenChange={ handleOpenChange }>
        <DialogContent className="w-full max-w-6xl transition-all duration-200">
          <DialogHeader>
            <DialogTitle>Review Verification</DialogTitle>
            <DialogDescription>
              { verification.space.name } - { verification.space.location }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            { /* Partner Info */ }
            <div>
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">Partner</h4>
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border border-border/70">
                  { partnerAvatarUrl ? (
                    <AvatarImage
                      src={ partnerAvatarUrl }
                      alt={ `${verification.space.partner.name} avatar` }
                    />
                  ) : (
                    <AvatarFallback className="font-semibold text-muted-foreground">
                      { partnerInitials }
                    </AvatarFallback>
                  ) }
                </Avatar>
                <div>
                  <p className="text-sm">{ verification.space.partner.name }</p>
                  <p className="text-xs text-muted-foreground">@{ verification.space.partner.handle }</p>
                </div>
              </div>
            </div>

          { /* Documents + optional rejection form */ }
            <div
              className={ cn(
                'space-y-4',
                showRejectForm &&
                  'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:gap-6 lg:items-start lg:space-y-0'
              ) }
            >
              <div className="space-y-2">
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  Verification Documents ({ verification.documents.length })
                </h4>
                <div className="space-y-2">
                  { verification.documents.map((doc) => (
                    <div
                      key={ doc.id }
                      className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <FiFileText className="size-5 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium">
                            { DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            { doc.mime_type } - { (doc.file_size_bytes / 1024).toFixed(1) } KB
                          </p>
                        </div>
                      </div>
                      { doc.url && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={ doc.url } target="_blank" rel="noopener noreferrer">
                            <FiExternalLink className="size-4" aria-hidden="true" />
                            View
                          </a>
                        </Button>
                      ) }
                    </div>
                  )) }
                </div>
              </div>

              { showRejectForm && (
                <div className="space-y-3 rounded-md border border-border/70 bg-background/60 p-4">
                  <Label htmlFor="rejection-reason">Rejection Reason</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Provide a reason for rejection..."
                    value={ rejectionReason }
                    onChange={ (e) => setRejectionReason(e.target.value) }
                    rows={ 3 }
                    aria-label="Rejection reason"
                  />
                </div>
              ) }
            </div>
          </div>

          <DialogFooter className="gap-2">
            { !showRejectForm ? (
              <>
                <Button
                  variant="outline"
                  onClick={ () => setShowRejectForm(true) }
                  disabled={ isProcessing }
                >
                  <FiX className="size-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  onClick={ handleApproveClick }
                  disabled={ isProcessing }
                >
                  <FiCheck className="size-4" aria-hidden="true" />
                  { approveMutation.isPending ? 'Approving...' : 'Approve' }
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={ () => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  } }
                  disabled={ isProcessing }
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={ handleReject }
                  disabled={ !rejectionReason.trim() || isProcessing }
                >
                  { rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection' }
                </Button>
              </>
            ) }
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ showValidityModal }
        onOpenChange={ (isOpen) => {
          if (!isOpen) {
            setShowValidityModal(false);
            setDraftValidUntil('');
          }
        } }
      >
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Select validity end date</DialogTitle>
            <DialogDescription>
              Pick when this approval should expire. Dates prior to today are blocked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 border-b border-border/60 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="mt-4">
                <p className="text-sm font-medium">Validity option</p>
                <p className="text-xs text-muted-foreground">
                  { isIndefinite
                    ? 'Approvals flagged as indefinite will never expire.'
                    : 'Select when this approval should end before confirming.' }
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-muted-foreground">Indefinite</span>
                <Switch
                  checked={ isIndefinite }
                  onCheckedChange={ toggleIndefiniteInModal }
                  aria-label="Mark approval as indefinite"
                />
              </div>
            </div>
          </div>
          <div
            className={ cn(
              'flex items-center justify-center transition-opacity',
              isIndefinite && 'pointer-events-none opacity-60'
            ) }
            aria-hidden={ isIndefinite ? 'true' : undefined }
          >
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={ draftValidUntil ? new Date(draftValidUntil) : undefined }
              fromYear={ calendarYearRange.fromYear }
              toYear={ calendarYearRange.toYear }
              fromDate={ today }
              onSelect={ (date) => {
                if (date) {
                  setDraftValidUntil(formatDateForInput(date));
                }
              } }
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={ () => {
                setShowValidityModal(false);
                setDraftValidUntil('');
              } }
              disabled={ isProcessing }
            >
              Cancel
            </Button>
            <Button
              onClick={ handleValidityConfirm }
              disabled={ isProcessing || (!isIndefinite && !draftValidUntil) }
            >
              { isProcessing ? 'Approving...' : 'Confirm & approve' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
