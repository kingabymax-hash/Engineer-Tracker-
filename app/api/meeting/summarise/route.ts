import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const SUMMARISE_PROMPT = `You are a professional meeting notes assistant. Given a meeting transcript, extract and return ONLY valid JSON with no markdown, no explanation.

Fields:
- key_notes: array of strings — the most important discussion points and decisions made, as clear concise bullet points
- todo_list: array of objects with fields: task (string), priority (one of High / Medium / Low), owner (string or null if not mentioned)

Order the todo_list by priority: High first, then Medium, then Low.
If something cannot be determined, omit it rather than guessing.`;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      `${SUMMARISE_PROMPT}\n\nTranscript:\n${transcript}`
    );
    const responseText = result.response.text();

    const cleaned = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Summarisation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
