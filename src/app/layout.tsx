import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "منجرچت — ManjarChat",
  description:
    "منجرچت: مسنجر سریع و مدرن با اقتصاد «منجر» 🪙 — چت، ویس، گروه، کانال، فروشگاه و پرمیوم",
  keywords: ["منجرچت", "ManjarChat", "چت", "پیام‌رسان", "منجر", "مسنجر"],
  applicationName: "ManjarChat",
  icons: {
    icon: "/manjar-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f2e2c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground overflow-hidden">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
