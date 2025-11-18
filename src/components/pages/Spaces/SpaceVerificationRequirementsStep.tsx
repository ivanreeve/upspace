'use client';

import { ChangeEvent, useMemo, useRef } from 'react';
import { FiAlertCircle, FiTrash, FiUpload } from 'react-icons/fi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const VERIFICATION_REQUIREMENTS = [
  {
    id: 'dti_registration',
    label: 'DTI Registration (or SEC registration for corporations)',
    description: 'Submit your DTI certificate of business name registration or SEC papers for corporations.',
  },
  {
    id: 'representative_id',
    label: 'Government ID of the authorized representative',
    description: 'Attach a valid government-issued ID for the person managing the listing or acting as the authorized signatory.',
  },
  {
    id: 'tax_registration',
    label: 'Tax registration (e.g., BIR Certificate of Registration)',
    description: 'Include your latest tax registration certificate so we can verify compliance.',
  }
] as const;

export type VerificationRequirementId = typeof VERIFICATION_REQUIREMENTS[number]['id'];

type SpaceVerificationRequirementsStepProps = {
  uploads: Record<VerificationRequirementId, File | null>;
  onUpload: (requirementId: VerificationRequirementId, file: File) => void;
  onRemove: (requirementId: VerificationRequirementId) => void;
};

const ACCEPTED_FILE_TYPES = 'application/pdf,image/*';

export function SpaceVerificationRequirementsStep({
  uploads,
  onUpload,
  onRemove,
}: SpaceVerificationRequirementsStepProps) {
  const fileInputRefs = useRef<Record<VerificationRequirementId, HTMLInputElement | null>>({} as Record<VerificationRequirementId, HTMLInputElement | null>);

  const sortedRequirements = useMemo(() => VERIFICATION_REQUIREMENTS.slice(), []);

  const handleFileChange = (requirementId: VerificationRequirementId, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(requirementId, file);
    }

    event.target.value = '';
  };

  const handleTriggerPicker = (requirementId: VerificationRequirementId) => {
    fileInputRefs.current[requirementId]?.click();
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
          const uploadedFile = uploads[requirement.id];
          const hasFile = Boolean(uploadedFile);

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
                <Badge variant={ hasFile ? 'default' : 'secondary' } className="self-start">
                  { hasFile ? 'Ready' : 'Required' }
                </Badge>
              </div>
              <div className="mt-4 space-y-3">
                <Label htmlFor={ `requirement-upload-${requirement.id}` } className="text-sm font-medium">
                  Document upload
                </Label>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      { hasFile ? uploadedFile?.name : 'No file uploaded yet' }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      { hasFile ? 'Replace the file if you need to update it.' : 'Make sure the file is clear and legible.' }
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={ (element) => {
                        fileInputRefs.current[requirement.id] = element;
                      } }
                      id={ `requirement-upload-${requirement.id}` }
                      type="file"
                      accept={ ACCEPTED_FILE_TYPES }
                      className="sr-only"
                      onChange={ (event) => handleFileChange(requirement.id, event) }
                    />
                    <Button type="button" variant="outline" onClick={ () => handleTriggerPicker(requirement.id) }>
                      <FiUpload className="mr-2 size-4" aria-hidden="true" />
                      { hasFile ? 'Replace file' : 'Upload file' }
                    </Button>
                    { hasFile && (
                      <Button type="button" variant="ghost" onClick={ () => onRemove(requirement.id) }>
                        <FiTrash className="mr-2 size-4" aria-hidden="true" />
                        Remove
                      </Button>
                    ) }
                  </div>
                </div>
              </div>
            </div>
          );
        }) }
      </div>
    </section>
  );
}
