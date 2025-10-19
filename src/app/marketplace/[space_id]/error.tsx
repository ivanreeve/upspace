'use client';

export default function Error({
  error,
  reset,
}: { error: Error; reset: () => void }) {
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-xl rounded-lg border p-6">
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">{ error.message || 'Please try again.' }</p>
        <button
          type="button"
          onClick={ reset }
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm bg-primary text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
