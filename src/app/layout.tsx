import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';

import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistration } from '@/components/common/ServiceWorkerRegistration';

export const metadata: Metadata = {
  title: 'UpSpace',
  description: 'A marketplace and management platform for coworking spaces.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0f172a',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: [{ url: '/favicon.ico' }],
    apple: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UpSpace',
  },
};

export default function RootLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          { children }
          <Toaster />
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
