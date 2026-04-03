import type { Metadata, Viewport } from "next";

import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { DeveloperErrorModal } from "@/components/ui/developer-error-modal";

const APP_NAME = "Hunita";
const APP_DESCRIPTION = "Sistem Management Perumahan yang transparan.";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: ["Hunita", "manajemen perumahan", "IPL", "iuran warga", "dashboard perumahan", "transaksi perumahan"],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/brand/icon-512-green.png",
        width: 512,
        height: 512,
        alt: `${APP_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/brand/icon-512-green.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/favicon-32-green.png", sizes: "32x32", type: "image/png" }],
    shortcut: "/brand/favicon-32-green.png",
    apple: [{ url: "/apple-icon-green.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
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
