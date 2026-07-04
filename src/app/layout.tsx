import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "后台管理系统",
  description: "基于 Next.js + Supabase 的简单后台管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
