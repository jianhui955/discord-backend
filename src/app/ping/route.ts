import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function logPing(method: string) {
  console.log(`[ping] ${method} ${new Date().toISOString()}`);
}

export function GET() {
  logPing("GET");
  return NextResponse.json({ status: "ok" });
}

export function HEAD() {
  logPing("HEAD");
  return new NextResponse(null, { status: 200 });
}
