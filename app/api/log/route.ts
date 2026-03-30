import { NextRequest, NextResponse } from "next/server";
import { createRecord } from "@/lib/airtable";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_name, type, priority, summary, full_description, raw_transcript } = body;

    const today = new Date().toISOString().split("T")[0];

    const fields: Record<string, unknown> = {
      "Client Name": client_name || "Unknown",
      "Date Logged": today,
      Type: type || "Other",
      Priority: priority || "Medium",
      Summary: summary || "",
      "Full Description": full_description || "",
      "Raw Transcript": raw_transcript || "",
      Status: "Open",
    };

    const { id } = await createRecord(fields);

    return NextResponse.json({ success: true, airtableId: id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Log error:", message);
    if (stack) console.error("Stack:", stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
