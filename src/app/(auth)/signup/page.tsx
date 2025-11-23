import type { Metadata } from 'next';

import AuthSignUp from '@/components/pages/Auth/SignUp/Auth.SignUp';

export const metadata: Metadata = {
  title: 'Sign Up - Upspace',
  description:
    'Create your Upspace account to book workspaces, invite your team, and manage hybrid collaboration with ease.',
};

export default function SignUpPage() {
  return <AuthSignUp />;
}
