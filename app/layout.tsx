import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Wastewater Viral Surveillance",
  description:
    "Wastewater (sewage) viral surveillance for SARS-CoV-2, influenza, RSV and more — aggregated from public sources worldwide, with historical depth.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
