'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  SpaceFormFields,
  createSpaceFormDefaults,
  spaceSchema,
  SpaceFormValues
} from '@/components/pages/Spaces/SpaceForms';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import NavBar from '@/components/ui/navbar';
import { useSpacesStore } from '@/stores/useSpacesStore';

export default function SpaceCreateRoute() {
  const router = useRouter();
  const createSpace = useSpacesStore((state) => state.createSpace);

  const form = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: createSpaceFormDefaults(),
  });

  const handleSubmit = (values: SpaceFormValues) => {
    const spaceId = createSpace(values);
    toast.success(`${values.name} created.`);
    router.push(`/spaces/${spaceId}`);
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Space setup</p>
            <h1 className="text-3xl font-semibold tracking-tight">Add a coworking space</h1>
            <p className="text-base text-muted-foreground">
              Provide the source-of-truth location details so your listing stays accurate across UpSpace.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/spaces" className="inline-flex items-center gap-2">
              <FiArrowLeft className="size-4" aria-hidden="true" />
              Back to spaces
            </Link>
          </Button>
        </div>

        <Card className="mt-8 border-border/70 bg-background/80">
          <CardHeader>
            <CardTitle>Space information</CardTitle>
            <CardDescription>Schema-aligned fields that capture a space’s address and location.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form { ...form }>
              <form className="space-y-6" onSubmit={ form.handleSubmit(handleSubmit) }>
                <SpaceFormFields form={ form } />
                <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={ () => router.push('/spaces') }>
                    Cancel
                  </Button>
                  <Button type="submit">Save space</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
