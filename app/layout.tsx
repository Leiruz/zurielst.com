import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { ClientEnhancements } from '@/components/registry/client-enhancements';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Zuriel Shanley Tanyory',
  description:
    'Security engineer in Singapore. Forward Deployed AI & Automation Security Engineer at Singtel, founder of CiTaDel, Information Security at NUS.',
  metadataBase: new URL('https://zurielst.com'),
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
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <ClientEnhancements />
        </ThemeProvider>
      </body>
    </html>
  );
}
