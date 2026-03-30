import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const EXTRACTION_PROMPT = `You are a field notes extraction assistant. Given a voice transcript from a client services call, extract the following fields and return ONLY valid JSON with no markdown, no explanation.

Fields:
- client_name: string (the name of the client or company mentioned)
- type: one of [Bug, Change Request, Upgrade, Complaint, Other]
- priority: one of [Low, Medium, High, Critical] — infer from urgency and language
- summary: string (one sentence, max 100 chars)
- full_description: string (full detail of the issue or request)

If a field cannot be determined, use null.`;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(`${EXTRACTION_PROMPT}\n\nTranscript:\n${transcript}`);
    const response = result.response;
    const responseText = response.text();

    // Strip markdown code fences if present
    const cleaned = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Extraction error:", message);
    if (stack) console.error("Stack:", stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
