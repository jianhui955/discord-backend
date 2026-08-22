import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isUptimeRobot(request: Request) {
  return (request.headers.get("user-agent") || "")
    .toLowerCase()
    .includes("uptimerobot");
}

function logPing(method: string) {
  console.log(`[ping] ${method} ${new Date().toISOString()}`);
}

export function GET(request: Request) {
  if (isUptimeRobot(request)) {
    logPing("GET");
  }
  return NextResponse.json({ status: "ok" });
}

export function HEAD(request: Request) {
  if (isUptimeRobot(request)) {
    logPing("HEAD");
  }
  return new NextResponse(null, { status: 200 });
}
