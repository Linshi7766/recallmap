import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recall",
  description: "A misconception detector that helps you find hidden gaps.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
