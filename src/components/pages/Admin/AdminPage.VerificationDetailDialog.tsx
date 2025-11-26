'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
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

type StatusBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const STATUS_METADATA: Record<string, { label: string; badge: StatusBadgeVariant }> = {
  draft: {
    label: 'Draft',
    badge: 'secondary',
  },
  in_review: {
    label: 'In review',
    badge: 'secondary',
  },
  approved: {
    label: 'Approved',
    badge: 'default',
  },
  rejected: {
    label: 'Rejected',
    badge: 'destructive',
  },
  expired: {
    label: 'Expired',
    badge: 'destructive',
  },
};

const getStatusMetadata = (status: string) =>
  STATUS_METADATA[status] ?? {
    label: status.replace(/_/g, ' '),
    badge: 'outline' as StatusBadgeVariant,
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
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [validUntil, setValidUntil] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [draftValidUntil, setDraftValidUntil] = useState('');
  const [showValidityModal, setShowValidityModal] = useState(false);
  const [isTransitioningToValidity, setIsTransitioningToValidity] = useState(false);
  const transitioningRef = useRef(false);
  const [isReviewOpen, setIsReviewOpen] = useState(open);
  useEffect(() => {
    setIsReviewOpen(open);
  }, [open]);
  const partnerAvatarUrl = useCachedAvatar(verification?.space.partner.avatar_url ?? null);
  const partnerInitials = getInitials(
    verification?.space.partner.name ?? verification?.space.partner.handle ?? ''
  );

  const approveMutation = useApproveVerificationMutation();
  const rejectMutation = useRejectVerificationMutation();

  const resetDialogState = () => {
    setShowRejectionModal(false);
    setRejectionReason('');
    setValidUntil('');
    setIsIndefinite(false);
    setDraftValidUntil('');
    setShowValidityModal(false);
    setIsTransitioningToValidity(false);
    transitioningRef.current = false;
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
      setShowRejectionModal(false);
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
    setIsTransitioningToValidity(true);
    transitioningRef.current = true;
    setIsReviewOpen(false);
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
      setIsTransitioningToValidity(false);
      transitioningRef.current = false;
      await handleApprove();
      resetDialogState();
      onClose();
      return;
    }
    if (!draftValidUntil) {
      toast.error('Please select a validity end date before approving.');
      return;
    }
    setShowValidityModal(false);
    setIsTransitioningToValidity(false);
    transitioningRef.current = false;
    setValidUntil(draftValidUntil);
    await handleApprove(draftValidUntil);
    resetDialogState();
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setIsReviewOpen(isOpen);
    if (!isOpen && !isTransitioningToValidity && !transitioningRef.current) {
      resetDialogState();
      onClose();
    }
  };

  if (!verification) return null;

  const statusMeta = getStatusMetadata(verification.status);
  const statusLabel = statusMeta.label;
  const statusBadgeVariant = statusMeta.badge;
  const reviewedAtDate = verification.reviewed_at ? new Date(verification.reviewed_at) : null;
  const reviewedAtLabel =
    reviewedAtDate && !Number.isNaN(reviewedAtDate.getTime())
      ? format(reviewedAtDate, 'PPP p')
      : '';
  const validUntilDate = verification.valid_until ? new Date(verification.valid_until) : null;
  const validUntilLabel =
    validUntilDate && !Number.isNaN(validUntilDate.getTime())
      ? format(validUntilDate, 'PPP')
      : '';
  const isPending = verification.status === 'in_review';
  const processedSummary = reviewedAtLabel
    ? `Processed ${statusLabel.toLowerCase()} on ${reviewedAtLabel}`
    : `Verification ${statusLabel.toLowerCase()}`;

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
      <Dialog open={ isReviewOpen } onOpenChange={ handleOpenChange }>
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

            <div className="space-y-3 rounded-md border border-border/70 bg-background/60 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Verification status</p>
                  <p className="text-sm font-semibold text-foreground">{ statusLabel }</p>
                </div>
                <Badge variant={ statusBadgeVariant }>
                  { statusLabel }
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                { reviewedAtLabel && <p>Reviewed { reviewedAtLabel }</p> }
                { validUntilLabel && <p>Valid until { validUntilLabel }</p> }
              </div>
              { verification.rejected_reason && (
                <div className="mt-3 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive/80">
                    Rejection reason
                  </p>
                  <p className="text-sm">{ verification.rejected_reason }</p>
                </div>
              ) }
            </div>

          { /* Documents + optional rejection form */ }
            <div className="space-y-4">
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

            </div>
          </div>

        <DialogFooter className="flex items-center gap-2">
          <div className="flex-1">
            <Button
              variant="ghost"
              onClick={ () => {
                setIsReviewOpen(false);
                resetDialogState();
                onClose();
              } }
              disabled={ isProcessing }
            >
                Cancel
            </Button>
          </div>
          { isPending ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={ () => {
                  setIsReviewOpen(false);
                  setShowRejectionModal(true);
                } }
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
            </div>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              { processedSummary }
            </p>
          ) }
        </DialogFooter>
        </DialogContent>
      </Dialog>

        <Dialog
          open={ showRejectionModal }
          onOpenChange={ (isOpen) => {
            setShowRejectionModal(isOpen);
            if (!isOpen) {
              setRejectionReason('');
              setIsReviewOpen(true);
            } else {
              setIsReviewOpen(false);
            }
          } }
        >
        <DialogContent className="w-full max-w-lg transition-all duration-200">
          <DialogHeader>
            <DialogTitle>Reject verification request</DialogTitle>
            <DialogDescription className="mb-4">
              Provide a brief explanation so the partner knows why their request was declined.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="queue-rejection-reason">Rejection reason</Label>
            <Textarea
              id="queue-rejection-reason"
              rows={ 4 }
              placeholder="Explain why this verification request is being rejected..."
              value={ rejectionReason }
              onChange={ (event) => setRejectionReason(event.target.value) }
              aria-label="Rejection reason"
              className="mb-4"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={ () => setShowRejectionModal(false) }
              disabled={ isProcessing }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={ handleReject }
              disabled={ isProcessing || !rejectionReason.trim() }
            >
              { rejectMutation.isPending ? 'Rejecting...' : 'Confirm rejection' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={ showValidityModal }
        onOpenChange={ (isOpen) => {
          if (!isOpen) {
            setShowValidityModal(false);
            setDraftValidUntil('');
            setIsTransitioningToValidity(false);
            transitioningRef.current = false;
            setIsReviewOpen(true);
          }
        } }
      >
        <DialogContent className="w-full max-w-6xl transition-all duration-200">
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
                setIsTransitioningToValidity(false);
                transitioningRef.current = false;
                setIsReviewOpen(true);
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
