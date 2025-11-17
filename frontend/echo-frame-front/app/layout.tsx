import type { Metadata } from "next";
import { Figtree, Literata, Victor_Mono } from 'next/font/google';
import "./globals.css";

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans' });
const literata = Literata({ subsets: ['latin'], variable: '--font-serif' });
const victorMono = Victor_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: "Echo Frame",
  description: "Watch Safe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${figtree.variable} ${literata.variable} ${victorMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
