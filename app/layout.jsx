export const metadata = {
  title: "Plant Vision Proxy",
  description: "API-only proxy for plant image identification"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
