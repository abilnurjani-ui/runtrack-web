import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SSO RUNNERS — Move // Connect // Grow',
  description: 'Samarinda Multi Sport Community (@samasama.olahraga) — Buat track lari sendiri, analisis GAP & ACWR, dan terhubung bersama pelari Samarinda.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased bg-zinc-50 text-zinc-950">{children}</body>
    </html>
  );
}
