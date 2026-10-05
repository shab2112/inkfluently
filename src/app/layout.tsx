import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inkfluently",
  description: "Daily phrase-paced dictation practice for legible, fluent handwriting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
