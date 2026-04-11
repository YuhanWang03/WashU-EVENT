import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Calendar + Gemini",
  description:
    "A Google Calendar style week view with a Gemini chat assistant panel.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gcal-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
