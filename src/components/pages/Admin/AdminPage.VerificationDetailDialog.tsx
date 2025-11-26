'use client';

import { useState } from 'react';
import {
FiCheck,
FiX,
FiExternalLink,
FiFileText
} from 'react-icons/fi';
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
import { useApproveVerificationMutation, useRejectVerificationMutation, type PendingVerification } from '@/hooks/api/useAdminVerifications';

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

export function VerificationDetailDialog({
 verification, open, onClose, 
}: Props) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approveMutation = useApproveVerificationMutation();
  const rejectMutation = useRejectVerificationMutation();

  const handleApprove = async () => {
    if (!verification) return;
    try {
      await approveMutation.mutateAsync(verification.id);
      toast.success('Space approved successfully');
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

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowRejectForm(false);
      setRejectionReason('');
      onClose();
    }
  };

  if (!verification) return null;

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Dialog open={ open } onOpenChange={ handleOpenChange }>
      <DialogContent className="max-w-2xl">
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
            <p className="text-sm">{ verification.space.partner.name }</p>
            <p className="text-xs text-muted-foreground">@{ verification.space.partner.handle }</p>
          </div>

          { /* Documents */ }
          <div>
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

          { /* Rejection Form */ }
          { showRejectForm && (
            <div className="space-y-3">
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

        <DialogFooter className="gap-2 sm:gap-0">
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
              <Button onClick={ handleApprove } disabled={ isProcessing }>
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
  );
}
