import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Next } from 'next/font/google';
import './globals.css';

const atkinson = Atkinson_Hyperlegible_Next({
  variable: '--font-atkinson',
  subsets: ['latin', 'latin-ext'],
  adjustFontFallback: false,
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'TEA-PTS',
  description: 'Programa Terapêutico Singular para pessoas com TEA',
  icons: { icon: '/assets/favicon.ico' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
