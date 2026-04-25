import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server-store";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  return NextResponse.json({
    ok: true,
    ...getSnapshot(address),
  });
}
