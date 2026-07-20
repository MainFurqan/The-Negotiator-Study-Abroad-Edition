import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TopNav } from "@/components/shell/top-nav";
import { FlowBar } from "@/components/shell/flow-bar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Negotiator — AI study-abroad fee negotiation",
  description:
    "An AI voice agent that gets quotes from UK study-abroad consultancies, negotiates fees down with cross-quote leverage, and delivers a ranked GBP + PKR report.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TopNav />
          <FlowBar />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
