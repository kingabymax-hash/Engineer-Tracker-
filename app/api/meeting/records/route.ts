import { NextResponse } from "next/server";
import { getAllMeetingRecords } from "@/lib/airtable";

export async function GET() {
  try {
    const records = await getAllMeetingRecords();
    return NextResponse.json({ records });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Meeting records fetch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
