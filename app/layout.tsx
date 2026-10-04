import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LocalMind — Intelligent Document Investigator',
  description: 'Browser-native RAG for PDFs, images, and text documents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}