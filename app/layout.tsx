import type { Metadata, Viewport } from "next";

import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Smart Perumahan - UI Prototype",
  description: "Shadcn-styled Smart Perumahan dashboard for admin and warga flow.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Smart Perumahan",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d8f7a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
