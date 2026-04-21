import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MedFund – Emergency Medical Fund Wallet",
  description:
    "Transparent blockchain crowdfunding for emergency medical expenses on Stellar. Funds released to verified hospitals via milestone approvals.",
  keywords: ["medical", "crowdfunding", "blockchain", "stellar", "soroban", "xlm"],
  openGraph: {
    title: "MedFund – Emergency Medical Fund Wallet",
    description: "Transparent blockchain crowdfunding for emergency medical expenses on Stellar.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 5000,
              style: { borderRadius: "12px", fontSize: "14px" },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
