import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

type ReqBody = {
  image: string;                 // data URL or HTTPS URL
  question?: string;
  detail?: "low" | "high" | "auto";
  expectJson?: boolean;
  secret?: string;
};

const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-1.5-flash"; // fast, multimodal

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

    // 1) Try OpenAI first
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

      const text = response.choices?.[0]?.message?.content?.trim() ?? "";
      return NextResponse.json({
        provider: "openai",
        model: OPENAI_MODEL,
        text,
        data: tryJson(text)
      });
    } catch (err) {
      console.warn("OpenAI vision failed; falling back to Gemini:", err);
    }

    // 2) Fallback to Gemini
    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      // Build parts: prompt + image (inline base64 or URL)
      const parts: any[] = [{ text: prompt }];
      parts.push(
        image.startsWith("http")
          ? { fileData: { mimeType: guessMime(image), fileUri: image } }
          : { inlineData: { mimeType: "image/jpeg", data: image.split(",").pop() || image } }
      );

      const res = await model.generateContent({ contents: [{ role: "user", parts }] });
      const text = res.response?.text?.() ?? ""; // SDK exposes text() helper
      return NextResponse.json({
        provider: "gemini",
        model: GEMINI_MODEL,
        text,
        data: tryJson(text)
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

function tryJson(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
function guessMime(url: string) {
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
