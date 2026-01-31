'use client';

import dynamic from 'next/dynamic';
import type { ControllerRenderProps } from 'react-hook-form';

import { Skeleton } from '@/components/ui/skeleton';

 
type AnyDescriptionEditorProps = {
  field: ControllerRenderProps<any, any>;
};

function EditorSkeleton() {
  return (
    <div className="rounded-md border border-border/70">
      <div className="flex items-center gap-1 border-b border-border/50 bg-muted/50 px-2 py-1.5">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-7 w-7" />
      </div>
      <div className="min-h-[500px] bg-background px-3 py-3">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

const DescriptionEditorImpl = dynamic(
  () => import('./SpaceForms').then((mod) => ({ default: mod.DescriptionEditor, })),
  {
    ssr: false,
    loading: EditorSkeleton,
  }
);

export function DescriptionEditorDynamic(props: AnyDescriptionEditorProps) {
  return <DescriptionEditorImpl { ...props } />;
}
