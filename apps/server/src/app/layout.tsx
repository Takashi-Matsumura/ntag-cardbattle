import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NTag Battle - 管理画面",
  description: "NTag Battle サーバ管理画面",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
