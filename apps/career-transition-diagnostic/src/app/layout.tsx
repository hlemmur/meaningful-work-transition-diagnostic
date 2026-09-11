import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { MockModeBadge } from "@/components/mock-mode-badge";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
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
      className={`${sourceSans.variable} ${newsreader.variable} ${sourceSans.className} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <MockModeBadge />
        {children}
      </body>
    </html>
  );
}
