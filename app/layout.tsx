import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Experience Match",
  description:
    "Describe a problem and preview a request for someone with relevant practical experience.",
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
