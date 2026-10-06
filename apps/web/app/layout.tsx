import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { CartProvider } from "@/lib/cart";
import { getBusiness } from "@/lib/api";
import { Shell } from "@/components/shell";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "brissiecardetailing",
    template: "%s · brissiecardetailing",
  },
  description: "Mobile car detailing in Brisbane. We'll come to you. Book a detail and pay the deposit online.",
  icons: { icon: "/logo.svg", apple: "/logo.svg" },
  openGraph: {
    title: "brissiecardetailing",
    description: "Mobile car detailing at your place. Choose a service, a time, and leave a deposit.",
    type: "website",
    images: ["/logo.svg"],
    url: "https://brissiecardetailing.com.au",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const business = await getBusiness();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    telephone: business.phoneTel,
    description: business.locationLine,
    areaServed: "Brisbane",
    url: "https://brissiecardetailing.com.au",
    image: "/logo.svg",
    openingHours: "Mo-Su 07:00-19:00",
  };
  return (
    <html lang="en-AU" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <CartProvider>
          <Shell business={business}>{children}</Shell>
        </CartProvider>
      </body>
    </html>
  );
}
