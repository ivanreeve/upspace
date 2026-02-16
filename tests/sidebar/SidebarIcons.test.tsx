// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { AdminChrome } from '@/components/pages/Admin/AdminChrome';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';

// Fix "React is not defined" error in components
(global as any).React = React;

const queryClient = new QueryClient();

// Mock hooks
vi.mock('@/components/auth/SessionProvider', () => ({
  useSession: () => ({
    session: {
      user: {
        email: 'test@example.com',
        user_metadata: { role: 'customer', },
      },
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: () => ({
    data: {
      firstName: 'Test',
      handle: 'tester',
      role: 'customer',
      status: 'active',
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/use-cached-avatar', () => ({ useCachedAvatar: () => 'https://example.com/avatar.png', }));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false, }));

// Mock router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/marketplace',
}));

// Mock other components if necessary (e.g., specific complex ones)
vi.mock('@/components/ui/theme-switcher', () => ({ ThemeSwitcher: () => <div data-testid="theme-switcher" />, }));

// Mock specific icons if needed, but we want to verify their presence indirectly via rendering
// Actually, Lucide icons render as <svg ... class="lucide lucide-icon-name ..."> usually.
// Or just verifying no errors is good enough for now.

describe('Sidebar Icons Improvement', () => {
  it('renders MarketplaceChrome with updated icons without crashing', () => {
    render(
      <QueryClientProvider client={ queryClient }>
        <MarketplaceChrome>
          <div>Content</div>
        </MarketplaceChrome>
      </QueryClientProvider>
    );
    // Check for some text to ensure it rendered
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('renders AdminChrome with updated icons without crashing', () => {
    // Mock user role to be admin for this test if needed, or just render it
    // AdminChrome wraps MarketplaceChrome, so props flow through.
    // However, AdminChrome uses `useSession` internally via `MarketplaceChrome`.
    // Let's rely on the mock above which returns 'customer'.
    // AdminChrome might show different items based on role, but it should render.
    render(
      <QueryClientProvider client={ queryClient }>
        <AdminChrome>
          <div>Admin Content</div>
        </AdminChrome>
      </QueryClientProvider>
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('renders SpacesChrome with updated icons without crashing', () => {
    render(
      <QueryClientProvider client={ queryClient }>
        <SpacesChrome>
          <div>Spaces Content</div>
        </SpacesChrome>
      </QueryClientProvider>
    );
    expect(screen.getByText('Spaces Content')).toBeInTheDocument();
  });
});
