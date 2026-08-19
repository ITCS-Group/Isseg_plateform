import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ISSEG — Portail de gestion académique",
  description: "Institut Supérieur des Sciences de l'Éducation de Guinée",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="bg-page font-sans text-navy antialiased">{children}</body>
    </html>
  );
}
