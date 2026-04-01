import type { Metadata, Viewport } from "next";

import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { DeveloperErrorModal } from "@/components/ui/developer-error-modal";

export const metadata: Metadata = {
  title: "Smart Cluster - UI Prototype",
  description: "Shadcn-styled Smart Cluster dashboard for admin and warga flow.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Smart Cluster",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d8f7a",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <DeveloperErrorModal />
        <PwaRegister />
      </body>
    </html>
  );
}
