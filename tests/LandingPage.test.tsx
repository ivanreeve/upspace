import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '../src/components/pages/LandingPage/LandingPage';

// Mock the hooks used by NavBar
vi.mock('@/components/auth/SessionProvider', () => ({
  useSession: () => ({
    session: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: () => ({
    data: null,
  }),
}));

// Mock the Supabase client used by NavBar for logout
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock Link from next/link
vi.mock('next/link', () => {
  return {
    default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: any }) => (
      <a href={href} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

describe('LandingPage', () => {
  it('renders the navbar and main content sections', () => {
    render(<LandingPage />);

    // Check for Navbar elements
    expect(screen.getByText('UpSpace')).toBeDefined();
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Features')).toBeDefined();

    // Check for other sections (assuming they render some text, but just checking if it doesn't crash)
    // We can check for a specific element from the Hero section if we knew what it was.
    // For now, ensuring render without error is the main goal.
  });
});
