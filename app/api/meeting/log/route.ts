import { NextRequest, NextResponse } from "next/server";
import { createMeetingRecord } from "@/lib/airtable";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meeting_title, attendees, date, duration, key_notes, todo_list, raw_transcript } = body;

    const keyNotesText = Array.isArray(key_notes)
      ? key_notes.map((note: string) => `• ${note}`).join("\n")
      : key_notes || "";

    const todoListText = Array.isArray(todo_list)
      ? todo_list
          .map(
            (item: { task: string; priority: string; owner: string | null }, i: number) =>
              `${i + 1}. [${item.priority}] ${item.task}${item.owner ? ` (${item.owner})` : ""}`
          )
          .join("\n")
      : todo_list || "";

    const result = await createMeetingRecord({
      Date: date || new Date().toISOString().split("T")[0],
      Duration: duration || "Unknown",
      Attendees: attendees || "",
      "Meeting Title": meeting_title || "Untitled Meeting",
      "Key Notes": keyNotesText,
      "To Do List": todoListText,
      "Raw Transcript": raw_transcript || "",
    });

    return NextResponse.json({ success: true, airtableId: result.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Meeting log error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
