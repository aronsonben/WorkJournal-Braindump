import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ModeProvider } from './components/mode-context';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WorkJournal",
  description: "Your professional memory system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <ModeProvider>
          {children}
        </ModeProvider>
      </body>
    </html>
  );
}