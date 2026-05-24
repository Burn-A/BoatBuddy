import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BoatBuddy — Marine trip planner',
  description:
    'A mobile-first marine trip planner. GPS, tides, waves, marinas, and adaptive ETAs.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Use the full screen on iOS Safari when added to Home Screen.
  viewportFit: 'cover',
  themeColor: '#0b1d2a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
