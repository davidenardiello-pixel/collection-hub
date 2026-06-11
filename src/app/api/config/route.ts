import { NextResponse } from "next/server";
import { isCloudModeConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    cloud: isCloudModeConfigured(),
  });
}
