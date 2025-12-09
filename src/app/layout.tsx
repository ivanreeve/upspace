import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';

import { AuthProfileSync } from '@/components/auth/AuthProfileSync';
import { SessionProvider } from '@/components/auth/SessionProvider';
import { ServiceWorkerRegistration } from '@/components/common/ServiceWorkerRegistration';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { NavigationProgressBar } from '@/components/ui/navigation-progress-bar';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'UpSpace',
  description: 'A marketplace and management platform for coworking spaces.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
        sizes: 'any', 
      },
      {
        url: '/favicon.svg',
        sizes: 'any', 
      }
    ],
    shortcut: [{ url: '/favicon.svg', }],
    apple: [{
      url: '/favicon.svg',
      type: 'image/svg+xml', 
    }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UpSpace',
  },
};

export const viewport: Viewport = {
  themeColor: '#023347',
  viewportFit: 'cover',
};

export default function RootLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <SessionProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              disableTransitionOnChange
            >
              <NavigationProgressBar />
              <AuthProfileSync />
              { children }
              <Toaster />
              <ServiceWorkerRegistration />
            </ThemeProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
