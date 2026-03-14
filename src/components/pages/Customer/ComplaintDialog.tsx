'use client';

import { useState, type FormEvent } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
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
import { COMPLAINT_CATEGORY_OPTIONS, COMPLAINT_CATEGORY_VALUES, type ComplaintCategory } from '@/lib/complaints/constants';
import { useSubmitComplaintMutation } from '@/hooks/api/useComplaints';

type ComplaintDialogProps = {
  bookingId: string;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

const DEFAULT_CATEGORY = COMPLAINT_CATEGORY_VALUES[0];

export function ComplaintDialog({
  bookingId,
  hideTrigger = false,
  onOpenChange,
  open,
}: ComplaintDialogProps) {
  const submitMutation = useSubmitComplaintMutation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintCategory>(DEFAULT_CATEGORY);
  const [description, setDescription] = useState('');
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? open : uncontrolledOpen;

  const resetForm = () => {
    setCategory(DEFAULT_CATEGORY);
    setDescription('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(open);
    }
    onOpenChange?.(open);

    if (!open) {
      resetForm();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 10) {
      toast.error('Description must be at least 10 characters.');
      return;
    }

    try {
      const result = await submitMutation.mutateAsync({
        bookingId,
        category,
        description: trimmedDescription,
      });

      toast.success(result.message);
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to submit complaint.');
    }
  };

  return (
    <>
      { !hideTrigger && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-3 text-[13px]"
          aria-label="File a complaint"
          onClick={ () => handleOpenChange(true) }
          disabled={ submitMutation.isPending }
        >
          <FiAlertCircle className="size-3.5" aria-hidden="true" />
          Complaint
        </Button>
      ) }

      <Dialog open={ isOpen } onOpenChange={ handleOpenChange }>
        <DialogContent
          className="sm:max-w-[520px]"
          dismissible={ !submitMutation.isPending }
        >
          <DialogHeader>
            <DialogTitle>File a complaint</DialogTitle>
            <DialogDescription className="mb-2">
              Describe your issue with this booking. The space partner will review your complaint.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={ handleSubmit }>
            <div className="space-y-2">
              <Label htmlFor="complaint-category">Category</Label>
              <Select
                value={ category }
                onValueChange={ (value) => setCategory(value as ComplaintCategory) }
              >
                <SelectTrigger
                  id="complaint-category"
                  aria-label="Select complaint category"
                  className="rounded-md"
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  { COMPLAINT_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={ option.value } value={ option.value }>
                      { option.label }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="complaint-description">
                Description
                <span className="ml-1 text-xs text-muted-foreground">(min 10 characters)</span>
              </Label>
              <Textarea
                id="complaint-description"
                value={ description }
                onChange={ (event) => setDescription(event.currentTarget.value) }
                placeholder="Describe the issue you experienced with this booking."
                aria-label="Complaint description"
                className="min-h-24 rounded-md"
                maxLength={ 2000 }
              />
              <p className="text-xs text-muted-foreground">
                { description.trim().length } / 2000 characters
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={ () => handleOpenChange(false) }
                className="rounded-md"
                disabled={ submitMutation.isPending }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-md"
                disabled={ submitMutation.isPending }
                loading={ submitMutation.isPending }
                loadingText="Submitting…"
              >
                Submit complaint
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
