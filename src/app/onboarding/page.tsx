import type { Metadata } from 'next';

import OnboardingExperience from './OnboardingExperience';

import NavBar from '@/components/ui/navbar';

export const metadata: Metadata = {
  title: 'Onboarding - Upspace',
  description: 'Share your name and first role to continue your Upspace onboarding experience.',
};

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background overflow-hidden">
      <NavBar variant="logo-only" />
      <OnboardingExperience />
    </div>
  );
}
