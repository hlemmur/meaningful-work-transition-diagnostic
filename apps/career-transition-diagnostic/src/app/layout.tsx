import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MockModeBadge } from "@/components/mock-mode-badge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meaningful Work Transition Diagnostic",
  description:
    "A paid Jungian-informed career-transition diagnostic with human review before delivery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f7f1ea] text-[#2b211c]">
        <MockModeBadge />
        {children}
      </body>
    </html>
  );
}
