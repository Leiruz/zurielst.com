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
import { BUILD_DATE } from '@/lib/build-info';
import { createProfileStructuredData } from '@/lib/structured-data';
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
const nameParts = profile.identity.name.split(' ');
const firstName = nameParts[0] ?? '';
const lastName = nameParts.at(-1) ?? '';
const profileStructuredData = createProfileStructuredData(profile, BUILD_DATE);
const structuredDataJson = JSON.stringify(profileStructuredData).replaceAll('<', '\\u003c');

export const metadata: Metadata = {
  title: profile.meta.title,
  description: profile.meta.description,
  authors: [{ name: profile.identity.name, url: profile.meta.og.url }],
  keywords: [
    ...profile.identity.roles,
    ...profile.identity.tagline.split('.').map((keyword) => keyword.trim()).filter(Boolean),
  ],
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
    firstName,
    lastName,
    username: profile.identity.github.username,
  },
  twitter: {
    // summary_large_image plus twitter:image and og:image must land atomically with the asset.
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredDataJson }}
        />
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
