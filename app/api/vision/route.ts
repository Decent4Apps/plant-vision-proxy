import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-1.5-flash";

function originAllowed(headers) {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const origin = headers.get("origin") || "";
  return !allowed.length || allowed.includes(origin);
}

function tryJson(s) { try { return JSON.parse(s); } catch { return null; } }
function guessMime(url) {
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function POST(req) {
  try {
    if (!originAllowed(req.headers)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));

    if (process.env.PROXY_SECRET && body?.secret !== process.env.PROXY_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const image = body?.image;
    const question = body?.question;
    const detail = body?.detail || "auto";
    const expectJson = body?.expectJson !== false;

    if (!image) {
      return NextResponse.json({ error: "Missing 'image' (data URL or https URL)" }, { status: 400 });
    }

    const prompt =
      question ||
      "Identify the plant in the image. Return concise JSON with keys: scientificName, commonName, description (one sentence). State uncertainty if unsure.";

    // --- Primary: OpenAI (dynamic import keeps build happy) ---
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const content = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: image, detail } }
      ];

      const r = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content }],
        temperature: 0.2,
        ...(expectJson ? { response_format: { type: "json_object" } } : {})
      });

      const text = r?.choices?.[0]?.message?.content?.trim() || "";
      return NextResponse.json({
        provider: "openai",
        model: OPENAI_MODEL,
        text,
        data: tryJson(text)
      });
    } catch (e) {
      console.warn("OpenAI failed → fallback Gemini:", e?.message || e);
    }

    // --- Fallback: Gemini (dynamic import) ---
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const parts = [{ text: prompt }];
      parts.push(
        image.startsWith("http")
          ? { fileData: { mimeType: guessMime(image), fileUri: image } }
          : { inlineData: { mimeType: "image/jpeg", data: image.split(",").pop() || image } }
      );

      const res = await model.generateContent({ contents: [{ role: "user", parts }] });
      const text = res?.response?.text?.() || "";
      return NextResponse.json({
        provider: "gemini",
        model: GEMINI_MODEL,
        text,
        data: tryJson(text)
      });
    } catch (e2) {
      console.error("Gemini failed:", e2?.message || e2);
      return NextResponse.json({ error: "Both providers failed" }, { status: 502 });
    }
  } catch (e) {
    console.error("Route error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
