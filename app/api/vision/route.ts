import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

// Use Node.js runtime so both SDKs work comfortably
export const runtime = "nodejs";
// If your images are base64, keep them modest (<15–20MB total)
export const maxDuration = 30;

type ReqBody = {
  image: string;                 // data URL (data:image/...;base64,xxx) OR https URL
  question?: string;             // optional task, default = identify plant
  detail?: "low" | "high" | "auto";
  expectJson?: boolean;          // true => ask model to return JSON
  secret?: string;               // optional shared secret
};

const OPENAI_MODEL = "gpt-4o-mini"; // or "gpt-4o"
const GEMINI_MODEL = "gemini-2.0-flash"; // fast & multimodal

function originAllowed(req: NextRequest) {
  const allowed = process.env.ALLOWED_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
  const origin = req.headers.get("origin") ?? "";
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}

export async function POST(req: NextRequest) {
  try {
    if (!originAllowed(req)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const body = (await req.json()) as ReqBody;

    if (process.env.PROXY_SECRET && body.secret !== process.env.PROXY_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { image, question, detail = "auto", expectJson = true } = body || {};
    if (!image) {
      return NextResponse.json({ error: "Missing 'image' (data URL or https URL)" }, { status: 400 });
    }

    const prompt =
      question ??
      "Identify the plant in the image. Return concise JSON with keys: scientificName, commonName, description (one sentence). State uncertainty if unsure.";

    // Try OpenAI first
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const content: any[] = [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url:
            typeof image === "string" && image.startsWith("http")
              ? { url: image, detail }
              : { url: image, detail } // data URL works too
        }
      ];

      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content }],
        temperature: 0.2,
        ...(expectJson ? { response_format: { type: "json_object" as const } } : {})
      });

      const text =
        response.choices?.[0]?.message?.content?.trim() ??
        "";

      return NextResponse.json({
        provider: "openai",
        model: OPENAI_MODEL,
        text,
        // try JSON parse; if fails, just echo text
        data: safeJson(text)
      });
    } catch (err) {
      // continue to fallback
      console.warn("OpenAI vision failed; falling back to Gemini:", err);
    }

    // Fallback: Gemini
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
      const contents = [
        { role: "user", parts: [{ text: prompt }] },
        {
          role: "user",
          parts: [
            image.startsWith("http")
              ? { fileData: { fileUri: image, mimeType: guessMime(image) } }
              : {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: image.split(",").pop() || image // allow raw base64 or data URL
                  }
                }
          ]
        }
      ];

      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents
      });

      const text = res.text?.trim() ?? "";
      return NextResponse.json({
        provider: "gemini",
        model: GEMINI_MODEL,
        text,
        data: safeJson(text)
      });
    } catch (err2) {
      console.error("Gemini fallback failed:", err2);
      return NextResponse.json({ error: "Both providers failed" }, { status: 502 });
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
function guessMime(url: string) {
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
