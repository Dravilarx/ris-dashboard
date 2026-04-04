import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RIS AMIS 2030 | Dashboard Premium de Radiología",
  description: "Capa personalizada de alta eficiencia para el sistema de información radiológica AMIS.",
};

import { DiagnosisProvider } from "@/components/providers/DiagnosisProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-[#020408] text-white">
        <DiagnosisProvider>
          {children}
        </DiagnosisProvider>
      </body>
    </html>
  );
}
