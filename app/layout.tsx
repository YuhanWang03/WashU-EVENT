import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Cadence",
  description: "Cadence — a smart study-planning assistant powered by DeepSeek.",
  icons: { icon: "/favicon.svg" },
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
