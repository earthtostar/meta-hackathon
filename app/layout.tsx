import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIVO — Experience Match",
  description:
    "Describe a difficult situation and compare it with relevant practical experiences — what was tried, what worked, and what is still unknown.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
