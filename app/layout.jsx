export const metadata = {
  title: "Plant Vision Proxy",
  description: "API-only proxy for plant image identification",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
