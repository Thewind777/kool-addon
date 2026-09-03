import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Group Order MVP',
  description: 'Shared group ordering with QR wallet transfers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}