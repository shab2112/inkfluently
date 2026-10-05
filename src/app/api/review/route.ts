import { NextRequest, NextResponse } from "next/server";
import { GeminiReviewError, reviewHandwritingPhoto } from "@/lib/gemini";

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
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    const result = await reviewHandwritingPhoto(
      base64,
      photo.type || "image/jpeg",
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
