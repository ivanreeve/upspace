import type { Metadata } from 'next';
import './globals.css';
import { Noto_Serif } from 'next/font/google'

const crimson = Noto_Serif({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-serif'
});

export const metadata: Metadata = {
  title: 'UpSpace',
  description: 'A marketplace and management platform for coworking spaces.',
  icons: {
    icon: 'favicon.svg'
  }
};

export default function RootLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={crimson.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
