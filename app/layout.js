import "./globals.css";

export const metadata = {
  title: "끝까지",
  description: "책 한 권을 끝내기 위한 집필 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
