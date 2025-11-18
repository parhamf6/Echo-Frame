import type { Metadata } from "next";
import { Figtree, Literata, Victor_Mono, Playfair_Display } from 'next/font/google';
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans' });
const literata = Literata({ subsets: ['latin'], variable: '--font-serif' });
const victorMono = Victor_Mono({ subsets: ['latin'], variable: '--font-mono' });
const playfair = Playfair_Display({subsets: ['latin'],variable: '--font-display'})

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${figtree.variable} ${literata.variable} ${victorMono.variable} ${playfair.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
