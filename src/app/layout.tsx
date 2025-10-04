import type { Metadata } from 'next';
import './globals.css';
import { Noto_Serif, EB_Garamond } from 'next/font/google';

const serif = Noto_Serif({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-serif',
});

const garamond = EB_Garamond({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-garamond',
});

export const metadata: Metadata = {
  title: 'UpSpace',
  description: 'A marketplace and management platform for coworking spaces.',
  icons: { icon: 'favicon.svg', },
};

export default function RootLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${garamond.variable}`} >
      <body>
        {children}
      </body>
    </html >
  );
}
