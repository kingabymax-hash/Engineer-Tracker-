import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY!);

// Allow up to 5 minutes for long transcriptions on Vercel
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let tmpPath: string | null = null;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSizeMB = buffer.length / (1024 * 1024);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let transcript: string;

    if (fileSizeMB > 15) {
      // Large file — use Gemini File API (supports up to 2GB)
      const tmpDir = join(tmpdir(), "meetinglog");
      await mkdir(tmpDir, { recursive: true });
      tmpPath = join(tmpDir, `recording-${Date.now()}.webm`);
      await writeFile(tmpPath, buffer);

      const uploadResult = await fileManager.uploadFile(tmpPath, {
        mimeType: audioFile.type || "audio/webm",
        displayName: `meeting-recording-${Date.now()}`,
      });

      // Wait for file to be processed
      let file = uploadResult.file;
      while (file.state === "PROCESSING") {
        await new Promise((r) => setTimeout(r, 2000));
        file = await fileManager.getFile(file.name);
      }

      if (file.state === "FAILED") {
        throw new Error("Gemini file processing failed");
      }

      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        "Transcribe this audio exactly as spoken. Return ONLY the transcription text, nothing else — no labels, no quotes, no explanation.",
      ]);

      transcript = result.response.text().trim();

      // Clean up uploaded file from Gemini
      try {
        await fileManager.deleteFile(file.name);
      } catch {
        // Non-critical — files auto-expire after 48h
      }
    } else {
      // Small file — use inline base64 (faster)
      const base64Audio = buffer.toString("base64");

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: audioFile.type || "audio/webm",
            data: base64Audio,
          },
        },
        "Transcribe this audio exactly as spoken. Return ONLY the transcription text, nothing else — no labels, no quotes, no explanation.",
      ]);

      transcript = result.response.text().trim();
    }

    // Parse duration from header
    const durationHeader = req.headers.get("x-audio-duration");
    let duration = "Unknown";
    if (durationHeader) {
      const totalSeconds = Math.round(parseFloat(durationHeader));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      if (minutes === 0) {
        duration = `${seconds} seconds`;
      } else if (seconds === 0) {
        duration = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
      } else {
        duration = `${minutes} minute${minutes !== 1 ? "s" : ""} ${seconds} seconds`;
      }
    }

    return NextResponse.json({ transcript, duration });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Meeting transcription error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Clean up temp file
    if (tmpPath) {
      try {
        await unlink(tmpPath);
      } catch {
        // Ignore
      }
    }
  }
}
