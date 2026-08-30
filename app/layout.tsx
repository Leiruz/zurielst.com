import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { ClientEnhancements } from '@/components/registry/client-enhancements';
import profileJson from '@/content/profile.json';
import type { Profile } from '@/content/schema';
import { hasPublicMedia } from '@/lib/media';
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
const ogImageAvailable = hasPublicMedia(profile.meta.og.image);

export const metadata: Metadata = {
  title: profile.meta.title,
  description: profile.meta.description,
  metadataBase: new URL(profile.meta.og.url),
  openGraph: {
    title: profile.meta.og.title,
    description: profile.meta.og.description,
    url: profile.meta.og.url,
    type: profile.meta.og.type,
    ...(ogImageAvailable ? { images: [{ url: profile.meta.og.image }] } : {}),
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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <ClientEnhancements />
        </ThemeProvider>
      </body>
    </html>
  );
}
