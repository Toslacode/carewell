import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WardProvider } from "@/lib/store/ward-store";
import { PrefsProvider } from "@/lib/store/prefs";
import { UtilityBar } from "@/components/layout/UtilityBar";

export const metadata: Metadata = {
  title: "CLARIO — מחלקה פנימית ב׳",
  description:
    "עוזר סבב למחלקה פנימית. תמלול חי בעברית, מיון קליני אוטומטי והפקת משימות — הכל באישור רופא. אב־טיפוס עם נתוני הדגמה בדיוניים בלבד.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f7f1e8",
  width: "device-width",
  initialScale: 1,
};

/**
 * The whole product is Hebrew-first, so RTL is set once at the document root
 * and everything inside is authored with logical properties (ps/pe/ms/me,
 * border-s/e, start/end). Nothing in this app is a mirrored LTR layout.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          // SF Pro on Apple hardware, Heebo everywhere else — and Heebo always
          // for Hebrew. One stack, so Hebrew and Latin sit at the same weight.
          ["--font-ui" as string]:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Heebo", "Segoe UI", system-ui, sans-serif',
        }}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-chip focus:bg-navy focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-on-navy"
        >
          דילוג לתוכן הראשי
        </a>
        <PrefsProvider>
          <WardProvider>
            {children}
            <UtilityBar />
          </WardProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
