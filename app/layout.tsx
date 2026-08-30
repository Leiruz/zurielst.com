import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { ClientEnhancements } from '@/components/registry/client-enhancements';
import {
  IntroCover,
  IntroFirstPaintHead,
} from '@/components/registry/intro-first-paint';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
import '../styles/globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

const profile = profileJson as Profile;

export const metadata: Metadata = {
  title: profile.meta.title,
  description: profile.meta.description,
  metadataBase: new URL(profile.meta.og.url),
  alternates: { canonical: profile.meta.og.url },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: profile.meta.og.title,
    description: profile.meta.og.description,
    url: profile.meta.og.url,
    siteName: profile.identity.name,
    type: profile.meta.og.type,
  },
  twitter: {
    card: 'summary',
    title: profile.meta.og.title,
    description: profile.meta.og.description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090a' },
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <IntroFirstPaintHead />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <IntroCover />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <ClientEnhancements />
        </ThemeProvider>
      </body>
    </html>
  );
}
