import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ClubProvider } from "@/lib/contexts/club-context";
import "./globals.css";

// Charte Quatools : Fraunces (titres), Inter (corps/UI), IBM Plex Mono (labels).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://hub.quatools.fr"),
  title: {
    default: "Quatools Notifications",
    template: "%s · Quatools Notifications",
  },
  description:
    "Le hub de notifications de votre organisation : configurez vos canaux et vos messages, et laissez chaque membre maîtriser ce qu'il reçoit et où.",
  // Hors prod, on empêche toute indexation au niveau métadonnées (en plus du robots.txt).
  robots:
    process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true"
      ? undefined
      : { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} antialiased`}
      >
        <ClubProvider>
          <Navbar />
          <main className="container mx-auto px-4 py-8 max-w-5xl">
            {children}
          </main>
          <Footer />
        </ClubProvider>
        <Toaster />
      </body>
    </html>
  );
}
