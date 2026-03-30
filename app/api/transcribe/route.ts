import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: audioFile.type || "audio/webm",
          data: base64Audio,
        },
      },
      "Transcribe this audio exactly as spoken. Return ONLY the transcription text, nothing else — no labels, no quotes, no explanation.",
    ]);

    const transcript = result.response.text().trim();

    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Transcription error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
