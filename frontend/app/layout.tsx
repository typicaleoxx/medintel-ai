// this file is the root layout for the entire medintel app
// it wraps every page with shared html structure and global styles

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedIntel",
  description: "AI powered clinical documentation and patient interaction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
