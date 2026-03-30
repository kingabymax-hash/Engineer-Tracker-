import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldLog",
  description: "Voice-powered field logging for client services",
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
