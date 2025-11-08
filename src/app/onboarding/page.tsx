import type { Metadata } from 'next';

import NavBar from '@/components/ui/navbar';
import OnboardingExperience from './OnboardingExperience';

export const metadata: Metadata = {
  title: 'Onboarding - Upspace',
  description: 'Share your name and first role to continue your Upspace onboarding experience.',
};

export default function OnboardingPage() {
  return (
    <>
      <NavBar variant="logo-only" />
      <OnboardingExperience />
    </>
  );
}
