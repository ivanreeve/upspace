'use client';

import { useReducer, useRef } from 'react';
import {
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
import {
  useApproveVerificationMutation,
  useRejectVerificationMutation,
  type PendingVerification,
  type VerificationDocument
} from '@/hooks/api/useAdminVerifications';
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

const formatDateForInput = (date: Date) => format(date, 'yyyy-MM-dd');

type VerificationDialogState = {
  rejectionReason: string;
  showRejectionModal: boolean;
  validUntil: string;
  isIndefinite: boolean;
  draftValidUntil: string;
  showValidityModal: boolean;
  isTransitioningToValidity: boolean;
  isReviewOpen: boolean;
};

const INITIAL_DIALOG_STATE: VerificationDialogState = {
  rejectionReason: '',
  showRejectionModal: false,
  validUntil: '',
  isIndefinite: false,
  draftValidUntil: '',
  showValidityModal: false,
  isTransitioningToValidity: false,
  isReviewOpen: true,
};

type VerificationDialogAction =
  | {
    type: 'SET_REJECTION_REASON';
    payload: string;
  }
  | {
    type: 'OPEN_REJECTION_MODAL';
  }
  | {
    type: 'CLOSE_REJECTION_MODAL';
  }
  | {
    type: 'CLOSE_REJECTION_MODAL_AND_RETURN_TO_REVIEW';
  }
  | {
    type: 'OPEN_VALIDITY_MODAL';
    payload: string;
  }
  | {
    type: 'CLOSE_VALIDITY_MODAL';
  }
  | {
    type: 'CLOSE_VALIDITY_MODAL_AND_RETURN_TO_REVIEW';
  }
  | {
    type: 'SET_DRAFT_VALID_UNTIL';
    payload: string;
  }
  | {
    type: 'SET_VALID_UNTIL';
    payload: string;
  }
  | {
    type: 'SET_IS_INDEFINITE';
    payload: boolean;
  }
  | {
    type: 'SET_REVIEW_OPEN';
    payload: boolean;
  }
  | {
    type: 'RESET_EPHEMERAL';
  };

function verificationDialogReducer(
  state: VerificationDialogState,
  action: VerificationDialogAction
): VerificationDialogState {
  switch (action.type) {
    case 'SET_REJECTION_REASON':
      return {
        ...state,
        rejectionReason: action.payload,
      };
    case 'OPEN_REJECTION_MODAL':
      return {
        ...state,
        showRejectionModal: true,
        isReviewOpen: false,
      };
    case 'CLOSE_REJECTION_MODAL':
      return {
        ...state,
        showRejectionModal: false,
        rejectionReason: '',
      };
    case 'CLOSE_REJECTION_MODAL_AND_RETURN_TO_REVIEW':
      return {
        ...state,
        showRejectionModal: false,
        rejectionReason: '',
        isReviewOpen: true,
      };
    case 'OPEN_VALIDITY_MODAL':
      return {
        ...state,
        draftValidUntil: action.payload,
        showValidityModal: true,
        isTransitioningToValidity: true,
        isReviewOpen: false,
      };
    case 'CLOSE_VALIDITY_MODAL':
      return {
        ...state,
        showValidityModal: false,
        isTransitioningToValidity: false,
      };
    case 'CLOSE_VALIDITY_MODAL_AND_RETURN_TO_REVIEW':
      return {
        ...state,
        draftValidUntil: '',
        showValidityModal: false,
        isTransitioningToValidity: false,
        isReviewOpen: true,
      };
    case 'SET_DRAFT_VALID_UNTIL':
      return {
        ...state,
        draftValidUntil: action.payload,
      };
    case 'SET_VALID_UNTIL':
      return {
        ...state,
        validUntil: action.payload,
      };
    case 'SET_IS_INDEFINITE':
      return {
        ...state,
        isIndefinite: action.payload,
      };
    case 'SET_REVIEW_OPEN':
      return {
        ...state,
        isReviewOpen: action.payload,
      };
    case 'RESET_EPHEMERAL':
      return {
        ...state,
        rejectionReason: '',
        showRejectionModal: false,
        validUntil: '',
        isIndefinite: false,
        draftValidUntil: '',
        showValidityModal: false,
        isTransitioningToValidity: false,
      };
    default:
      return state;
  }
}

function PartnerSection({
  verification,
  partnerAvatarUrl,
  partnerInitials,
}: {
  verification: PendingVerification;
  partnerAvatarUrl: string | null;
  partnerInitials: string;
}) {
  return (
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
  );
}

function VerificationStatusSection({
  statusLabel,
  statusBadgeVariant,
  reviewedAtLabel,
  validUntilLabel,
  rejectedReason,
}: {
  statusLabel: string;
  statusBadgeVariant: StatusBadgeVariant;
  reviewedAtLabel: string;
  validUntilLabel: string;
  rejectedReason: string | null;
}) {
  return (
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
      { rejectedReason && (
        <div className="mt-3 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive/80">
            Rejection reason
          </p>
          <p className="text-sm">{ rejectedReason }</p>
        </div>
      ) }
    </div>
  );
}

function MarketplaceVisibilitySection({
  isSpacePublished,
  unpublishedReason,
  unpublishedByAdmin,
  unpublishedAtLabel,
  visibilityHeadline,
  visibilityHelpText,
}: {
  isSpacePublished: boolean;
  unpublishedReason: string;
  unpublishedByAdmin: boolean;
  unpublishedAtLabel: string;
  visibilityHeadline: string;
  visibilityHelpText: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-background/60 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Marketplace visibility</p>
          <p className="text-sm font-semibold text-foreground">{ visibilityHeadline }</p>
          <p className="text-xs text-muted-foreground">{ visibilityHelpText }</p>
        </div>
        <Badge variant={ isSpacePublished ? 'success' : 'destructive' }>
          { isSpacePublished ? 'Published' : 'Hidden' }
        </Badge>
      </div>

      { !isSpacePublished && (unpublishedReason || unpublishedAtLabel || unpublishedByAdmin) && (
        <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm">
          { unpublishedReason && <p className="font-medium">{ unpublishedReason }</p> }
          { unpublishedAtLabel && (
            <p className="text-xs text-muted-foreground">Last hidden on { unpublishedAtLabel }</p>
          ) }
          { unpublishedByAdmin && (
            <p className="text-xs text-muted-foreground">Marked hidden by an admin.</p>
          ) }
        </div>
      ) }
    </div>
  );
}

function DocumentRow({ document, }: { document: VerificationDocument }) {
  return (
    <div
      className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <FiFileText className="size-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">
            { DOCUMENT_TYPE_LABELS[document.document_type] ?? document.document_type }
          </p>
          <p className="text-xs text-muted-foreground">
            { document.mime_type } - { (document.file_size_bytes / 1024).toFixed(1) } KB
          </p>
        </div>
      </div>
      { document.url && (
        <Button asChild size="sm" variant="ghost">
          <a href={ document.url } target="_blank" rel="noopener noreferrer">
            <FiExternalLink className="size-4" aria-hidden="true" />
            View
          </a>
        </Button>
      ) }
    </div>
  );
}

function DocumentsSection({ documents, }: { documents: VerificationDocument[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          Verification Documents ({ documents.length })
        </h4>
        <div className="space-y-2">
          { documents.map((document) => (
            <DocumentRow key={ document.id } document={ document } />
          )) }
        </div>
      </div>
    </div>
  );
}

function ReviewDialogFooter({
  isProcessing,
  approveLabel,
  onCancel,
  onReject,
  onApprove,
}: {
  isProcessing: boolean;
  approveLabel: string;
  onCancel: () => void;
  onReject: () => void;
  onApprove: () => void;
}) {
  return (
    <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
      <div>
        <Button variant="ghost" onClick={ onCancel } disabled={ isProcessing }>
          Cancel
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={ onReject } disabled={ isProcessing }>
          <FiX className="size-4" aria-hidden="true" />
          Reject
        </Button>
        <Button onClick={ onApprove } disabled={ isProcessing }>
          <FiCheck className="size-4" aria-hidden="true" />
          { approveLabel }
        </Button>
      </div>
    </DialogFooter>
  );
}

function RejectionReasonDialog({
  open,
  rejectionReason,
  isProcessing,
  isRejectPending,
  onOpenChange,
  onRejectionReasonChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  rejectionReason: string;
  isProcessing: boolean;
  isRejectPending: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRejectionReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
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
            onChange={ (event) => onRejectionReasonChange(event.target.value) }
            aria-label="Rejection reason"
            className="mb-4"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={ onCancel } disabled={ isProcessing }>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={ onConfirm }
            disabled={ isProcessing || !rejectionReason.trim() }
          >
            { isRejectPending ? 'Rejecting...' : 'Confirm rejection' }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValidityDialog({
  open,
  isIndefinite,
  draftValidUntil,
  isProcessing,
  today,
  fromYear,
  toYear,
  onOpenChange,
  onToggleIndefinite,
  onSelectDate,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  isIndefinite: boolean;
  draftValidUntil: string;
  isProcessing: boolean;
  today: Date;
  fromYear: number;
  toYear: number;
  onOpenChange: (isOpen: boolean) => void;
  onToggleIndefinite: (next: boolean) => void;
  onSelectDate: (date: Date | undefined) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
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
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Indefinite</span>
              <Switch
                checked={ isIndefinite }
                onCheckedChange={ onToggleIndefinite }
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
            fromYear={ fromYear }
            toYear={ toYear }
            fromDate={ today }
            onSelect={ onSelectDate }
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={ onCancel } disabled={ isProcessing }>
            Cancel
          </Button>
          <Button onClick={ onConfirm } disabled={ isProcessing || (!isIndefinite && !draftValidUntil) }>
            { isProcessing ? 'Renewing...' : 'Renew' }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VerificationDetailDialog({
  verification,
  open,
  onClose,
}: Props) {
  const [state, dispatch] = useReducer(verificationDialogReducer, INITIAL_DIALOG_STATE);
  const transitioningRef = useRef(false);

  const isReviewDialogOpen = open && state.isReviewOpen;
  const partnerAvatarUrl = useCachedAvatar(verification?.space.partner.avatar_url ?? null);
  const partnerInitials = getInitials(
    verification?.space.partner.name ?? verification?.space.partner.handle ?? ''
  );

  const approveMutation = useApproveVerificationMutation();
  const rejectMutation = useRejectVerificationMutation();

  const resetDialogState = () => {
    dispatch({ type: 'RESET_EPHEMERAL', });
    transitioningRef.current = false;
  };

  const handleApprove = async (overrideValidUntil?: string) => {
    if (!verification) return;

    const expiryDate = state.isIndefinite ? null : overrideValidUntil ?? state.validUntil;
    if (!state.isIndefinite && !expiryDate) {
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
    if (!verification || !state.rejectionReason.trim()) return;

    try {
      await rejectMutation.mutateAsync({
        verificationId: verification.id,
        reason: state.rejectionReason.trim(),
      });
      toast.success('Space verification rejected');
      dispatch({ type: 'CLOSE_REJECTION_MODAL', });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject verification');
    }
  };

  const handleApproveClick = () => {
    const todayIso = formatDateForInput(new Date());
    dispatch({
      type: 'OPEN_VALIDITY_MODAL',
      payload: state.validUntil || todayIso,
    });
    transitioningRef.current = true;
  };

  const toggleIndefiniteInModal = (next: boolean) => {
    dispatch({
 type: 'SET_IS_INDEFINITE',
payload: next, 
});
    if (next) {
      dispatch({
 type: 'SET_DRAFT_VALID_UNTIL',
payload: '', 
});
      return;
    }

    dispatch({
      type: 'SET_DRAFT_VALID_UNTIL',
      payload: state.validUntil || formatDateForInput(new Date()),
    });
  };

  const handleValidityConfirm = async () => {
    if (state.isIndefinite) {
      dispatch({ type: 'CLOSE_VALIDITY_MODAL', });
      transitioningRef.current = false;
      await handleApprove();
      resetDialogState();
      onClose();
      return;
    }

    if (!state.draftValidUntil) {
      toast.error('Please select a validity end date before approving.');
      return;
    }

    dispatch({ type: 'CLOSE_VALIDITY_MODAL', });
    transitioningRef.current = false;
    dispatch({
 type: 'SET_VALID_UNTIL',
payload: state.draftValidUntil, 
});
    await handleApprove(state.draftValidUntil);
    resetDialogState();
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    dispatch({
 type: 'SET_REVIEW_OPEN',
payload: isOpen, 
});

    if (!isOpen && !state.isTransitioningToValidity && !transitioningRef.current) {
      resetDialogState();
      onClose();
    }
  };

  if (!verification) return null;

  const today = new Date();
  const validUntilDate = verification.valid_until ? new Date(verification.valid_until) : null;
  const isValidUntilExpired = Boolean(validUntilDate && validUntilDate < today);
  const derivedStatus =
    verification.status === 'expired' || (verification.status === 'approved' && isValidUntilExpired)
      ? 'expired'
      : verification.status;
  const statusMeta = getStatusMetadata(derivedStatus);
  const statusLabel = statusMeta.label;
  const statusBadgeVariant = statusMeta.badge;
  const reviewedAtDate = verification.reviewed_at ? new Date(verification.reviewed_at) : null;
  const reviewedAtLabel =
    reviewedAtDate && !Number.isNaN(reviewedAtDate.getTime())
      ? format(reviewedAtDate, 'PPP p')
      : '';
  const validUntilLabel =
    validUntilDate && !Number.isNaN(validUntilDate.getTime())
      ? format(validUntilDate, 'PPP')
      : '';
  const isRenewal = derivedStatus === 'expired';

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;
  const calendarYearRange = {
    fromYear: today.getFullYear(),
    toYear: today.getFullYear() + 10,
  };

  const isSpacePublished = verification.space.is_published;
  const unpublishedReason = verification.space.unpublished_reason ?? '';
  const unpublishedByAdmin = verification.space.unpublished_by_admin;
  const unpublishedAtLabel = verification.space.unpublished_at
    ? format(new Date(verification.space.unpublished_at), 'PPP p')
    : '';
  const visibilityHeadline = isSpacePublished
    ? 'Visible to customers'
    : 'Hidden from marketplace';
  const visibilityHelpText = isSpacePublished
    ? 'Space appears in search, discovery, and booking flows.'
    : `Hidden ${unpublishedByAdmin ? 'by an admin' : 'per partner request'}${unpublishedAtLabel ? ` since ${unpublishedAtLabel}` : ''}.`;

  const approveLabel = approveMutation.isPending
    ? isRenewal
      ? 'Renewing...'
      : 'Approving...'
    : isRenewal
      ? 'Renew'
      : 'Approve';

  return (
    <>
      <Dialog open={ isReviewDialogOpen } onOpenChange={ handleOpenChange }>
        <DialogContent className="max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden transition-all duration-200">
          <DialogHeader>
            <DialogTitle>Review Verification</DialogTitle>
            <DialogDescription>
              { verification.space.name } - { verification.space.location }
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(100vh-18rem)] space-y-6 overflow-y-auto py-4">
            <PartnerSection
              verification={ verification }
              partnerAvatarUrl={ partnerAvatarUrl }
              partnerInitials={ partnerInitials }
            />

            <VerificationStatusSection
              statusLabel={ statusLabel }
              statusBadgeVariant={ statusBadgeVariant }
              reviewedAtLabel={ reviewedAtLabel }
              validUntilLabel={ validUntilLabel }
              rejectedReason={ verification.rejected_reason }
            />

            <MarketplaceVisibilitySection
              isSpacePublished={ isSpacePublished }
              unpublishedReason={ unpublishedReason }
              unpublishedByAdmin={ unpublishedByAdmin }
              unpublishedAtLabel={ unpublishedAtLabel }
              visibilityHeadline={ visibilityHeadline }
              visibilityHelpText={ visibilityHelpText }
            />

            <DocumentsSection documents={ verification.documents } />
          </div>

          <ReviewDialogFooter
            isProcessing={ isProcessing }
            approveLabel={ approveLabel }
            onCancel={ () => {
              dispatch({
 type: 'SET_REVIEW_OPEN',
payload: false, 
});
              resetDialogState();
              onClose();
            } }
            onReject={ () => dispatch({ type: 'OPEN_REJECTION_MODAL', }) }
            onApprove={ handleApproveClick }
          />
        </DialogContent>
      </Dialog>

      <RejectionReasonDialog
        open={ state.showRejectionModal }
        rejectionReason={ state.rejectionReason }
        isProcessing={ isProcessing }
        isRejectPending={ rejectMutation.isPending }
        onOpenChange={ (isOpen) => {
          if (!isOpen) {
            dispatch({ type: 'CLOSE_REJECTION_MODAL_AND_RETURN_TO_REVIEW', });
            return;
          }
          dispatch({ type: 'OPEN_REJECTION_MODAL', });
        } }
        onRejectionReasonChange={ (value) =>
          dispatch({
 type: 'SET_REJECTION_REASON',
payload: value, 
})
        }
        onCancel={ () => dispatch({ type: 'CLOSE_REJECTION_MODAL_AND_RETURN_TO_REVIEW', }) }
        onConfirm={ handleReject }
      />

      <ValidityDialog
        open={ state.showValidityModal }
        isIndefinite={ state.isIndefinite }
        draftValidUntil={ state.draftValidUntil }
        isProcessing={ isProcessing }
        today={ today }
        fromYear={ calendarYearRange.fromYear }
        toYear={ calendarYearRange.toYear }
        onOpenChange={ (isOpen) => {
          if (!isOpen) {
            dispatch({ type: 'CLOSE_VALIDITY_MODAL_AND_RETURN_TO_REVIEW', });
            transitioningRef.current = false;
          }
        } }
        onToggleIndefinite={ toggleIndefiniteInModal }
        onSelectDate={ (date) => {
          if (date) {
            dispatch({
              type: 'SET_DRAFT_VALID_UNTIL',
              payload: formatDateForInput(date),
            });
          }
        } }
        onCancel={ () => {
          dispatch({ type: 'CLOSE_VALIDITY_MODAL_AND_RETURN_TO_REVIEW', });
          transitioningRef.current = false;
        } }
        onConfirm={ handleValidityConfirm }
      />
    </>
  );
}
