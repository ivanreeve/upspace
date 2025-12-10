'use client';

import { ChangeEvent, useMemo, useRef } from 'react';
import { FiAlertCircle, FiTrash, FiUpload } from 'react-icons/fi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ACCEPTED_FILE_TYPES = 'application/pdf,image/*';

export const VERIFICATION_REQUIREMENTS = [
  {
    id: 'dti_registration',
    label: 'DTI Registration (or SEC registration for corporations)',
    description: 'Submit your DTI certificate of business name registration or SEC papers for corporations.',
    slots: [
      {
        id: 'document',
        label: 'Certificate or registration',
        helper: 'Upload your official registration document so we can verify your business.',
      }
    ],
  },
  {
    id: 'tax_registration',
    label: 'Tax registration (e.g., BIR Certificate of Registration)',
    description: 'Include your latest tax registration certificate so we can verify compliance.',
    slots: [
      {
        id: 'document',
        label: 'Tax certificate',
        helper: 'Attach the most recent tax registration to show compliance.',
      }
    ],
  },
  {
    id: 'representative_id',
    label: 'Government ID of the authorized representative',
    description:
      'Attach front and back of the ID of one of these ids: Philsys National ID, Voter’s ID, Driver’s License, UMID, or Postal ID.',
    slots: [
      {
        id: 'front',
        label: 'Front of the government ID',
        helper: 'Include the photo, name, and ID number on the front.',
      },
      {
        id: 'back',
        label: 'Back of the government ID',
        helper: 'Include any barcode or security marks on the back.',
      }
    ],
  }
] as const;

export type VerificationRequirement = (typeof VERIFICATION_REQUIREMENTS)[number];
export type VerificationRequirementId = VerificationRequirement['id'];
type VerificationRequirementSlot = VerificationRequirement['slots'][number];
type ExistingUpload = { kind: 'existing'; name: string };
type VerificationSlot = File | ExistingUpload | null;

type SpaceVerificationRequirementsStepProps = {
  uploads: Record<VerificationRequirementId, VerificationSlot[]>;
  onUpload: (requirementId: VerificationRequirementId, slotIndex: number, file: File) => void;
  onRemove: (requirementId: VerificationRequirementId, slotIndex: number) => void;
  maxFileSizeBytes: number;
  maxFileSizeLabel: string;
  onInvalidFile: (message: string) => void;
};

export function SpaceVerificationRequirementsStep({
  uploads,
  onUpload,
  onRemove,
  maxFileSizeBytes,
  maxFileSizeLabel,
  onInvalidFile,
}: SpaceVerificationRequirementsStepProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({} as Record<string, HTMLInputElement | null>);

  const sortedRequirements = useMemo(() => VERIFICATION_REQUIREMENTS.slice(), []);

  const getInputKey = (requirementId: VerificationRequirementId, slot: VerificationRequirementSlot) =>
    `${requirementId}-${slot.id}`;

  const handleFileChange = (
    requirementId: VerificationRequirementId,
    slotIndex: number,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > maxFileSizeBytes) {
        onInvalidFile(`File must be ${maxFileSizeLabel} or smaller.`);
        event.target.value = '';
        return;
      }
      onUpload(requirementId, slotIndex, file);
    }

    event.target.value = '';
  };

  const handleTriggerPicker = (requirementId: VerificationRequirementId, slot: VerificationRequirementSlot) => {
    const key = getInputKey(requirementId, slot);
    fileInputRefs.current[key]?.click();
  };

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <FiAlertCircle className="mt-0.5 size-4 flex-shrink-0" aria-hidden="true" />
          Upload all required documents so we can verify your business before publishing your listing. Accepted formats: PDF, JPG, PNG.
        </p>
      </div>
      <div className="space-y-4">
        { sortedRequirements.map((requirement) => {
          const slotFiles = uploads[requirement.id] ?? requirement.slots.map(() => null);
          const isRequirementReady = slotFiles.every(Boolean);

          return (
            <div
              key={ requirement.id }
              className="rounded-lg border border-border/70 bg-background/60 p-4 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{ requirement.label }</h3>
                  <p className="text-sm text-muted-foreground">{ requirement.description }</p>
                </div>
                <Badge variant={ isRequirementReady ? 'default' : 'secondary' } className="self-start">
                  { isRequirementReady ? 'Ready' : 'Required' }
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                { requirement.slots.map((slot, slotIndex) => {
                  const slotFile = slotFiles[slotIndex];
                  const slotFileName = slotFile?.name ?? null;
                  const inputKey = getInputKey(requirement.id, slot);
                  const inputId = `requirement-upload-${inputKey}`;

                  return (
                    <div key={ inputKey } className="rounded-lg border border-border/60 bg-background/70 p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Label htmlFor={ inputId } className="text-sm font-medium">
                            { slot.label }
                          </Label>
                          { slot.helper && (
                            <p className="text-xs text-muted-foreground">{ slot.helper }</p>
                          ) }
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          { slotFile ? 'Uploaded' : 'Awaiting upload' }
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                          { slotFileName ?? 'No file uploaded yet' }
                          </p>
                          <p className="text-sm text-muted-foreground">
                            { slotFile ? 'Replace the file if you need to refresh it.' : 'Make sure the file is clear and legible.' }
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            ref={ (element) => {
                              fileInputRefs.current[inputKey] = element;
                            } }
                            id={ inputId }
                            type="file"
                            accept={ ACCEPTED_FILE_TYPES }
                            className="sr-only"
                            onChange={ (event) => handleFileChange(requirement.id, slotIndex, event) }
                          />
                          <Button type="button" variant="outline" onClick={ () => handleTriggerPicker(requirement.id, slot) } className="hover:!text-white">
                            <FiUpload className="mr-2 size-4" aria-hidden="true" />
                            { slotFile ? 'Replace file' : 'Upload file' }
                          </Button>
                          { slotFile && (
                            <Button type="button" variant="ghost" onClick={ () => onRemove(requirement.id, slotIndex) } className="hover:!text-white">
                              <FiTrash className="mr-2 size-4" aria-hidden="true" />
                              Remove
                            </Button>
                          ) }
                        </div>
                      </div>
                    </div>
                  );
                }) }
              </div>
            </div>
          );
        }) }
      </div>
    </section>
  );
}
