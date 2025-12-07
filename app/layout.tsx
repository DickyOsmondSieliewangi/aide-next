import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/contexts/user-context";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Little Aide - Energy Monitor",
  description: "Real-time IoT energy monitoring dashboard for tracking electrical device consumption",
  openGraph: {
    title: "Little Aide - Energy Monitor",
    description: "Real-time IoT energy monitoring dashboard for tracking electrical device consumption",
    images: ['/Frame 1.svg'],
    siteName: "Little Aide",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Little Aide - Energy Monitor",
    description: "Real-time IoT energy monitoring dashboard for tracking electrical device consumption",
    images: ['/Frame 1.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider>
          {children}
        </UserProvider>
        <Toaster position="top-right" richColors closeButton expand={true} />
      </body>
    </html>
  );
}
