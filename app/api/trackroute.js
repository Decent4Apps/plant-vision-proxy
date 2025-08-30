import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";

export const runtime = "edge";

function cors() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-analytics-secret",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-analytics-secret") ?? "";
  if (process.env.PROXY_SECRET && secret !== process.env.PROXY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors() });
  }

  const body = await req.json().catch(() => ({}));
  const { name, props } = body || {};
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing name" }, { status: 400, headers: cors() });
  }

  await track(name, props || {});
  return NextResponse.json({ ok: true }, { headers: cors() });
}
