'use client';

import { useMemo, useState } from 'react';
import { FiEye, FiFileText } from 'react-icons/fi';

import { VerificationDetailDialog } from './AdminPage.VerificationDetailDialog';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePendingVerificationsQuery, type PendingVerification } from '@/hooks/api/useAdminVerifications';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

export function AdminVerificationsTable() {
  const {
    data: verifications,
    isLoading,
    isError,
    error,
    refetch,
  } = usePendingVerificationsQuery();
  const [selectedVerification, setSelectedVerification] = useState<PendingVerification | null>(null);

  const tableRows = useMemo(() => (verifications ?? []).map((v) => ({
    id: v.id,
    spaceName: v.space.name,
    location: v.space.location,
    partnerName: v.space.partner.name,
    partnerHandle: v.space.partner.handle,
    submittedAt: v.submitted_at,
    documentsCount: v.documents.length,
  })), [verifications]);

  const handleViewDetails = (verification: PendingVerification) => {
    setSelectedVerification(verification);
  };

  const handleCloseDialog = () => {
    setSelectedVerification(null);
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-border/70 bg-background/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Space</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            { Array.from({ length: 4, }).map((_, index) => (
              <TableRow key={ `skeleton-${index}` }>
                <TableCell>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-10 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-8 w-20 rounded-md" />
                </TableCell>
              </TableRow>
            )) }
          </TableBody>
        </Table>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-none bg-transparent">
        <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
          <div className="space-y-3">
            <CardTitle className="text-xl text-muted-foreground">Unable to load verifications</CardTitle>
            <CardDescription className="text-sm">
              { error instanceof Error ? error.message : 'Something went wrong.' }
            </CardDescription>
          </div>
          <Button variant="outline" onClick={ () => refetch() }>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!verifications || verifications.length === 0) {
    return (
      <Card className="border-dashed border-border/70 bg-background/60">
        <CardHeader>
          <CardTitle>No pending verifications</CardTitle>
          <CardDescription>All verification requests have been processed.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      { /* Desktop Table View */ }
      <div className="hidden rounded-md border border-border/70 bg-background/80 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Space</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            { tableRows.map((row) => {
              const verification = verifications.find((v) => v.id === row.id);
              return (
                <TableRow key={ row.id } className="cursor-pointer transition hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{ row.spaceName }</span>
                      <span className="text-xs text-muted-foreground">{ row.location }</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{ row.partnerName }</span>
                      <span className="text-xs">@{ row.partnerHandle }</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    { dateFormatter.format(new Date(row.submittedAt)) }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <FiFileText className="size-3" aria-hidden="true" />
                      { row.documentsCount }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={ () => verification && handleViewDetails(verification) }
                    >
                      <FiEye className="size-4" aria-hidden="true" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }) }
          </TableBody>
        </Table>
      </div>

      { /* Mobile Card View */ }
      <div className="space-y-3 md:hidden">
        { verifications.map((verification) => (
          <Card key={ verification.id } className="border-border/70 bg-background/80">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg leading-tight">{ verification.space.name }</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    { verification.space.location }
                  </CardDescription>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <FiFileText className="size-3" aria-hidden="true" />
                  { verification.documents.length }
                </Badge>
              </div>
            </CardHeader>
            <div className="border-t border-border/50 px-6 py-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Partner</span>
                    <p className="font-medium">{ verification.space.partner.name }</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Submitted</span>
                    <p className="font-medium">
                      { dateFormatter.format(new Date(verification.submitted_at)) }
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={ () => handleViewDetails(verification) }
                >
                  <FiEye className="size-4" aria-hidden="true" />
                  Review
                </Button>
              </div>
            </div>
          </Card>
        )) }
      </div>

      <VerificationDetailDialog
        verification={ selectedVerification }
        open={ Boolean(selectedVerification) }
        onClose={ handleCloseDialog }
      />
    </>
  );
}
