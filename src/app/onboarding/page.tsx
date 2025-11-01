import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Onboarding - Upspace',
  description: 'Get started with Upspace by setting up your workspace preferences and team members.',
};

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Welcome to Upspace</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          This is a placeholder onboarding experience. Customize this flow to collect the details your
          team needs before exploring available workspaces.
        </p>
      </div>
    </main>
  );
}
