import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import SiteSettings from "@/lib/db/models/SiteSettings";
import { invalidateSubscriptionCache } from "@/lib/subscription";
import { withAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// GET /api/admin/settings — fetch current site settings
export async function GET(req: NextRequest) {
  return withAdminSession(req, async () => {
    try {
      await connectDB();
      const settings = await SiteSettings.findById("site_settings").lean();
      if (!settings) {
        return NextResponse.json({ setupComplete: false, domain: "", phoneNumber: "" });
      }
      return NextResponse.json({
        setupComplete: settings.setupComplete,
        domain: settings.domain,
        phoneNumber: settings.phoneNumber,
        updatedAt: settings.updatedAt,
      });
    } catch (err) {
      console.error("[settings] GET error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

// POST /api/admin/settings — save/update site settings
export async function POST(req: NextRequest) {
  return withAdminSession(req, async () => {
    try {
      const body = await req.json();
      const domain = String(body.domain ?? "")
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/:\d+$/, "");
      const phoneNumber = String(body.phoneNumber ?? "").trim();

      if (!domain) {
        return NextResponse.json({ error: "Domain is required" }, { status: 400 });
      }
      if (!phoneNumber) {
        return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      }

      await connectDB();
      await SiteSettings.findByIdAndUpdate(
        "site_settings",
        { domain, phoneNumber, setupComplete: true, _id: "site_settings" },
        { upsert: true, new: true }
      );

      // Bust subscription cache so the new domain is checked immediately
      await invalidateSubscriptionCache();

      return NextResponse.json({ success: true, domain, phoneNumber });
    } catch (err) {
      console.error("[settings] POST error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
