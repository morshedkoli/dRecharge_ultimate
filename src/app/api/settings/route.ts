import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import SiteSettings from "@/lib/db/models/SiteSettings";


export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const settings = await SiteSettings.findById("site_settings").lean();
    
    return NextResponse.json({
      appName: settings?.appName || "PayChat",
      logoUrl: settings?.logoUrl || "/logo.png",
      primaryColor: settings?.primaryColor || "#134235",
      noticeText: (settings?.isNoticeEnabled ?? true) ? (settings?.noticeText || "") : "",
      isNoticeEnabled: settings?.isNoticeEnabled ?? true,
      bannerUrls: settings?.bannerUrls || [],
    });
  } catch (err) {
    console.error("[settings:user] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
