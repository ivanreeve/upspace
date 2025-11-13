import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';

import { AuthProfileSync } from '@/components/auth/AuthProfileSync';
import { SessionProvider } from '@/components/auth/SessionProvider';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistration } from '@/components/common/ServiceWorkerRegistration';

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

export const viewport: Viewport = { themeColor: '#023347', };

export default function RootLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProfileSync />
            { children }
            <Toaster />
            <ServiceWorkerRegistration />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
