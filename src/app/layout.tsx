import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';

import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'UpSpace',
  description: 'A marketplace and management platform for coworking spaces.',
  icons: { icon: 'favicon.svg', },
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
        </ThemeProvider>
      </body>
    </html>
  );
}
