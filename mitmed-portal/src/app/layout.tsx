import type { Metadata } from "next";
import { Montserrat, Domine } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const domine = Domine({
  variable: "--font-domine",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MitMed — Portal clinică",
  description: "Portal intern MitMed: fișe medicale, programări și administrare clienți.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${montserrat.variable} ${domine.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
