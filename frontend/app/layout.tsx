import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mitch OS 88",
  description: "A restricted desktop operating system that destroys its only song as people listen.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
