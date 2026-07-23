import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IntelliStore — AI-Powered Distributed Storage',
  description: 'Distributed storage platform with AI-driven hot/cold tiering and replication.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
