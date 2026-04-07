import type { Metadata, Viewport } from "next";
import Script from "next/script";

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
    images: ["/brand/og-image.png"],
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/brand/og-image.png"],
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

const stripExtensionAttributesScript = `
(() => {
  try {
    const removeExtensionAttrs = (el) => {
      if (!el || !el.attributes) return;
      for (let i = el.attributes.length - 1; i >= 0; i -= 1) {
        const attrName = el.attributes[i]?.name || "";
        if (attrName.startsWith("jf-ext-")) {
          el.removeAttribute(attrName);
        }
      }
    };

    const scanNode = (node) => {
      if (!node) return;
      if (node.nodeType === 1) {
        removeExtensionAttrs(node);
      }
      if (node.querySelectorAll) {
        const all = node.querySelectorAll("*");
        for (const item of all) {
          removeExtensionAttrs(item);
        }
      }
    };

    scanNode(document.documentElement);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const name = mutation.attributeName || "";
          if (name.startsWith("jf-ext-")) {
            removeExtensionAttrs(mutation.target);
          }
        }
        if (mutation.type === "childList" && mutation.addedNodes?.length) {
          for (const node of mutation.addedNodes) {
            scanNode(node);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  } catch (_) {
    // noop
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Script id="strip-extension-attrs" strategy="beforeInteractive">
          {stripExtensionAttributesScript}
        </Script>
        {children}
        <DeveloperErrorModal />
        <PwaRegister />
      </body>
    </html>
  );
}
