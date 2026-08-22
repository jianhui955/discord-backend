import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  console.log(`[ping] ${new Date().toISOString()}`);
  return NextResponse.json({ status: "ok" });
}
