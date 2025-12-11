import { JSDOM } from 'jsdom';
import React from 'react';
import {
  beforeAll,
  describe,
  expect,
  it,
  vi
} from 'vitest';

let render: typeof import('@testing-library/react').render;
let screen: typeof import('@testing-library/react').screen;

// Mock the hooks used by NavBar
vi.mock('@/components/auth/SessionProvider', () => ({
  useSession: () => ({
    session: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-user-profile', () => ({ useUserProfile: () => ({ data: null, }), }));

// Mock the Supabase client used by NavBar for logout
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn(), }, }), }));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock Link from next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
  }: { children: React.ReactNode; href: string; onClick?: any }) => (
    <a href={ href } onClick={ onClick }>
      { children }
    </a>
  ),
}));

// Mock next/image to avoid URL resolution in tests
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <div data-testid="mock-next-image">
      <span className="sr-only">{ props.alt }</span>
      <span aria-hidden="true">{ props.src }</span>
    </div>
  ),
}));

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const globalAny = globalThis as unknown as Record<string, unknown>;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'window', {
  value: dom.window,
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: dom.window.document,
  configurable: true,
});
Object.defineProperty(globalThis, 'location', {
  value: new URL('http://localhost'),
  configurable: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

globalAny.HTMLElement = dom.window.HTMLElement;
globalAny.Node = dom.window.Node;
globalAny.React = React;
globalAny.getComputedStyle = dom.window.getComputedStyle;
globalAny.requestAnimationFrame =
  dom.window.requestAnimationFrame ??
  ((callback: FrameRequestCallback) => globalThis.setTimeout(callback, 0));
globalAny.cancelAnimationFrame =
  dom.window.cancelAnimationFrame ??
  ((handle: number) => globalThis.clearTimeout(handle));
globalAny.ResizeObserver = dom.window.ResizeObserver ?? ResizeObserverMock;

let LandingPage: typeof import('../src/components/pages/LandingPage/LandingPage').default;

describe('LandingPage', () => {
  beforeAll(async () => {
    const testLib = await import('@testing-library/react');
    render = testLib.render;
    screen = testLib.screen;

    const landingPageModule = await import('../src/components/pages/LandingPage/LandingPage');
    LandingPage = landingPageModule.default;
  });

  it('renders the navbar and main content sections', () => {
    render(<LandingPage />);

    expect(screen.getByText('UpSpace')).toBeDefined();
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Features')).toBeDefined();
  });
});
