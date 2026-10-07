import { NextRequest, NextResponse } from "next/server";
import { GeminiReviewError, reviewHandwritingPhoto } from "@/lib/gemini";
import { cropToPage } from "@/lib/pageCropServer";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ code: "bad_request", message: "Expected multipart/form-data." }, { status: 400 });
  }

  const photo = form.get("photo");
  const passageText = form.get("passageText");
  const ageRaw = form.get("userAge");

  if (!(photo instanceof File) || typeof passageText !== "string" || !passageText.trim()) {
    return NextResponse.json(
      { code: "bad_request", message: "Expected a photo file and non-empty passageText." },
      { status: 400 }
    );
  }

  const userAge = ageRaw && !Array.isArray(ageRaw) ? parseInt(String(ageRaw), 10) : null;
  const arrayBuffer = await photo.arrayBuffer();

  // Mandatory, non-overridable: crop to just the page before anything is
  // forwarded to the AI service. This runs here, server-side, specifically
  // so it can't be skipped by any client — including a request sent directly
  // to this endpoint, bypassing the app's own UI entirely.
  const crop = await cropToPage(Buffer.from(arrayBuffer));
  if (crop.status === "unavailable") {
    return NextResponse.json(
      {
        code: "page_not_detected",
        message: `Couldn't confirm this photo is just the written page (${crop.reason}) — retake it with brighter, more even lighting and a plain background behind the page.`,
      },
      { status: 422 }
    );
  }
  const base64 = crop.buffer.toString("base64");

  try {
    const result = await reviewHandwritingPhoto(
      base64,
      crop.mimeType,
      passageText,
      Number.isFinite(userAge) ? userAge : null
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GeminiReviewError) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { code: "unknown", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
