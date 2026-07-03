import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/app-nav";
import { NewSessionFab } from "@/components/new-session-fab";
import { ThemeProvider } from "@/components/theme-provider";

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
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-24 pb-[calc(6rem+env(safe-area-inset-bottom))]">
            {children}
          </main>
          <NewSessionFab />
          <AppNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
