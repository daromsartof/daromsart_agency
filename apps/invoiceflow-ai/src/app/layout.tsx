import type { Metadata } from "next";
import "@daromsart/theme/tokens.css";
import "./globals.css";
import { Toaster } from "@daromsart/ui";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "InvoiceFlow",
    template: "%s · InvoiceFlow",
  },
  description: "Gestion de facturation — devis, factures, clients.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
