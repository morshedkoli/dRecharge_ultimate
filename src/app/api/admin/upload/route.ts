import { NextRequest, NextResponse } from "next/server";
import { withAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withAdminSession(req, async () => {
    try {
      const incomingFormData = await req.formData();
      const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;

      if (!apiKey) {
        return NextResponse.json({ error: "ImgBB API key is not configured" }, { status: 500 });
      }

      // Reconstruct form data for external API using base64 for reliable transmission
      const imgbbForm = new FormData();
      imgbbForm.append("key", apiKey);
      
      const file = incomingFormData.get("image") as File | null;
      const name = incomingFormData.get("name") as string | null;
      
      if (!file) {
        return NextResponse.json({ error: "No image file provided" }, { status: 400 });
      }

      // Convert the incoming web File blob to a base64 string
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString("base64");

      imgbbForm.append("image", base64Image);
      if (name) imgbbForm.append("name", name);

      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: imgbbForm,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return NextResponse.json(
          { error: err?.error?.message ?? `ImgBB proxy failed (${response.status})` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json({ url: data?.data?.url });
    } catch (err) {
      console.error("[upload api] error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
