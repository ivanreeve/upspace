'use client';

import { useState, type FormEvent } from 'react';
import { FiFlag } from 'react-icons/fi';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CHAT_REPORT_REASON_LABELS,
  CHAT_REPORT_REASON_OPTIONS,
  CHAT_REPORT_REASON_VALUES,
  type ChatReportReason
} from '@/lib/chat/reporting';
import { useSubmitChatReportMutation } from '@/hooks/api/useChatReports';

type ChatReportDialogProps = {
  roomId: string | null;
  targetLabel: string;
};

const DEFAULT_REASON = CHAT_REPORT_REASON_VALUES[0];

export function ChatReportDialog({
  roomId,
  targetLabel,
}: ChatReportDialogProps) {
  const submitReportMutation = useSubmitChatReportMutation();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ChatReportReason>(DEFAULT_REASON);
  const [details, setDetails] = useState('');

  const resetForm = () => {
    setReason(DEFAULT_REASON);
    setDetails('');
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!roomId) {
      toast.error('Select a conversation before reporting.');
      return;
    }

    try {
      const payloadDetails = details.trim();
      const result = await submitReportMutation.mutateAsync({
        roomId,
        reason,
        details: payloadDetails.length ? payloadDetails : undefined,
      });

      toast.success(result.message);
      setIsOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to submit report.');
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-md"
        aria-label="Report this conversation"
        onClick={ () => setIsOpen(true) }
        disabled={ !roomId || submitReportMutation.isPending }
      >
        <FiFlag className="size-4" aria-hidden="true" />
        <span className="ml-2 hidden sm:inline">Report</span>
      </Button>

      <Dialog open={ isOpen } onOpenChange={ handleOpenChange }>
        <DialogContent
          className="sm:max-w-[520px]"
          dismissible={ !submitReportMutation.isPending }
        >
          <DialogHeader>
            <DialogTitle>Report conversation</DialogTitle>
            <DialogDescription className="mb-2">
              Flag this chat with the { targetLabel } for moderator review.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={ handleSubmit }>
            <div className="space-y-2">
              <Label htmlFor="chat-report-reason">Reason</Label>
              <Select
                value={ reason }
                onValueChange={ (value) => setReason(value as ChatReportReason) }
              >
                <SelectTrigger
                  id="chat-report-reason"
                  aria-label="Select report reason"
                  className="rounded-md"
                >
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  { CHAT_REPORT_REASON_OPTIONS.map((option) => (
                    <SelectItem key={ option.value } value={ option.value }>
                      { option.label }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chat-report-details">
                Details
                <span className="ml-1 text-xs text-muted-foreground">(optional unless Other)</span>
              </Label>
              <Textarea
                id="chat-report-details"
                value={ details }
                onChange={ (event) => setDetails(event.currentTarget.value) }
                placeholder={ `Share details about the issue with this ${targetLabel}.` }
                aria-label="Additional report details"
                className="min-h-24 rounded-md"
                maxLength={ 1000 }
              />
              <p className="text-xs text-muted-foreground">
                Reason selected: { CHAT_REPORT_REASON_LABELS[reason] }
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={ () => handleOpenChange(false) }
                className="rounded-md"
                disabled={ submitReportMutation.isPending }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-md"
                disabled={ submitReportMutation.isPending }
                loading={ submitReportMutation.isPending }
                loadingText="Submitting…"
              >
                Submit report
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
