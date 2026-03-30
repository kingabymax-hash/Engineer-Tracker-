import { NextRequest, NextResponse } from "next/server";
import { getAllRecords, updateRecord } from "@/lib/airtable";

export async function GET() {
  try {
    const records = await getAllRecords();
    return NextResponse.json({ records });
  } catch (error: unknown) {
    console.error("Fetch records error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { recordId, fields } = await req.json();

    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }

    // If status is being set to Completed, auto-fill Completed Date
    if (fields.Status === "Completed" && !fields["Completed Date"]) {
      fields["Completed Date"] = new Date().toISOString().split("T")[0];
    }

    await updateRecord(recordId, fields);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Update record error:", error);
    const message = error instanceof Error ? error.message : "Failed to update record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
