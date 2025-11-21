import React from 'react';

export default function Marketplace() {
  return (
    <div className="px-4 max-w-[1440px] mx-auto py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground mt-1">
          Discover and book coworking spaces.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        { /* Placeholder content; replace with real listings */ }
        { [...Array(6)].map((_, i) => (
          <div
            key={ i }
            className="rounded-lg border bg-card text-card-foreground shadow-sm p-6"
          >
            <div className="h-28 w-full rounded-md bg-muted mb-4" />
            <h2 className="font-semibold">Space #{ i + 1 }</h2>
            <p className="text-sm text-muted-foreground">
              A short description of the space.
            </p>
          </div>
        )) }
      </section>
    </div>
  );
}
