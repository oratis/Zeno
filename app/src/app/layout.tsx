import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zeno — 描述需求，而不是品牌",
  description: "AI 原生购物入口：用对话从全网找到最适合你的商品。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
