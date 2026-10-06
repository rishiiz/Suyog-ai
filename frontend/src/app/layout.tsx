import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suyog AI — Elder Care Monitor",
  description: "Smart elder care monitoring with medicine reminders and safety alerts",
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
