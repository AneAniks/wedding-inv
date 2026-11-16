import type { Metadata } from "next";
import { wedding } from "../lib/wedding";
import "./globals.css";

export const metadata: Metadata = {
  title: `${wedding.names.en.join(" & ")} · Wedding Invitation`,
  description: `Join us for ${wedding.names.en.join(" and ")}’s wedding at ${wedding.venue}. Explore the celebration and confirm your attendance.`,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
