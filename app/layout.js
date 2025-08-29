// app/layout.js
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "Plant Vision Proxy",
  description: "OpenAI → Gemini fallback proxy for PlantScan AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Web Analytics (page views, referrers, etc.) */}
        <Analytics
          beforeSend={(event) => {
            try {
              const u = new URL(event.url);
              // Ignore API routes so analytics only logs page views
              if (u.pathname.startsWith("/api")) return null;
              // Strip query params to avoid leaking IDs/tokens
              u.search = "";
              return { ...event, url: u.toString() };
            } catch {
              return event;
            }
          }}
        />

        {/* Core Web Vitals & performance metrics */}
        <SpeedInsights />
      </body>
    </html>
  );
}
