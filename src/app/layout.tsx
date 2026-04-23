import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import connectDB from "@/lib/db/mongoose";
import SiteSettings from "@/lib/db/models/SiteSettings";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export async function generateMetadata(): Promise<Metadata> {
  try {
    await connectDB();
    const settings = await SiteSettings.findById("site_settings").lean();
    const appName = settings?.appName || "dRecharge";
    return {
      title: `${appName} — Admin`,
      description: `${appName} Admin Dashboard`,
    };
  } catch (err) {
    return { title: "Admin Dashboard" };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connectDB();
  const settings = await SiteSettings.findById("site_settings").lean();
  const primaryColor = settings?.primaryColor || "#134235";

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable} ${manrope.variable} font-inter antialiased bg-surface text-on-surface`}>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary-color: ${primaryColor};
          }
          .text-\\[\\#134235\\] { color: var(--primary-color) !important; }
          .bg-\\[\\#134235\\] { background-color: var(--primary-color) !important; }
          .border-\\[\\#134235\\] { border-color: var(--primary-color) !important; }
          .border-\\[\\#134235\\]\\/10 { border-color: color-mix(in srgb, var(--primary-color) 10%, transparent) !important; }
          .border-\\[\\#134235\\]\\/20 { border-color: color-mix(in srgb, var(--primary-color) 20%, transparent) !important; }
          .border-\\[\\#134235\\]\\/30 { border-color: color-mix(in srgb, var(--primary-color) 30%, transparent) !important; }
          .shadow-\\[\\#134235\\]\\/20 { box-shadow: 0 4px 14px 0 color-mix(in srgb, var(--primary-color) 20%, transparent) !important; }
          .from-\\[\\#134235\\] { --tw-gradient-from: var(--primary-color) var(--tw-gradient-from-position) !important; }
          .to-\\[\\#1B6B4D\\] { --tw-gradient-to: color-mix(in srgb, var(--primary-color) 80%, white) var(--tw-gradient-to-position) !important; }
          .hover\\:bg-\\[\\#134235\\]:hover { background-color: var(--primary-color) !important; }
          .hover\\:text-\\[\\#134235\\]:hover { color: var(--primary-color) !important; }
        ` }} />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
