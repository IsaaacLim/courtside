import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/app-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Volleyball Payments",
  description: "Track session attendance and player payments.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-24 pt-4">
          {children}
        </main>
        <AppNav />
      </body>
    </html>
  );
}
