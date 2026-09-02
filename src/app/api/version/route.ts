import { NextResponse } from "next/server";
import { getVersion } from "@/db/version";

export async function GET() {
  const version = await getVersion();
  return NextResponse.json({ version });
}
