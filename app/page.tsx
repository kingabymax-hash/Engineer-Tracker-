"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ───

interface ExtractedFields {
  client_name: string | null;
  type: string | null;
  priority: string | null;
  summary: string | null;
  full_description: string | null;
}

interface MeetingTodoItem {
  task: string;
  priority: string;
  owner: string | null;
}

interface MeetingResult {
  key_notes: string[];
  todo_list: MeetingTodoItem[];
}

type Tab = "client-issues" | "meeting-notes";
type ClientStage = "idle" | "recording" | "processing" | "review" | "submitting" | "done";
type MeetingStage = "idle" | "recording" | "processing" | "done";

// ─── Main Page ───

export default function RecordView() {
  const [activeTab, setActiveTab] = useState<Tab>("client-issues");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-1">FieldLog</h1>
        <p className="text-gray-500 text-center text-sm mb-6">Tap to record a voice note</p>

        {/* Tab Switcher */}
        <div className="flex bg-gray-200 rounded-lg p-1 mb-8">
          <button
            onClick={() => setActiveTab("client-issues")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === "client-issues"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Client Issues
          </button>
          <button
            onClick={() => setActiveTab("meeting-notes")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === "meeting-notes"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Meeting Notes
          </button>
        </div>

        {activeTab === "client-issues" ? <ClientIssueRecorder /> : <MeetingRecorder />}
      </div>
    </div>
  );
}

// ─── Client Issue Recorder (existing FieldLog flow) ───

function ClientIssueRecorder() {
  const [stage, setStage] = useState<ClientStage>("idle");
  const [timer, setTimer] = useState(0);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ef4444";
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setStage("recording");
      setTimer(0);

      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
      drawWaveform();
    } catch {
      setError("Could not access microphone. Please allow microphone access.");
    }
  };

  const stopRecording = async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    return new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  };

  const processAudio = async () => {
    setStage("processing");
    setError("");

    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) throw new Error("No audio recorded");

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const transcribeRes = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!transcribeRes.ok) {
        const err = await transcribeRes.json().catch(() => ({}));
        throw new Error(err.error || `Transcription failed (${transcribeRes.status})`);
      }
      const { transcript: text } = await transcribeRes.json();
      setTranscript(text);

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.error || `Field extraction failed (${extractRes.status})`);
      }
      const extracted = await extractRes.json();
      setFields(extracted);
      setStage("review");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Processing failed";
      setError(message);
      setStage("idle");
    }
  };

  const submitRecord = async () => {
    if (!fields) return;
    setStage("submitting");
    setError("");

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, raw_transcript: transcript }),
      });
      if (!res.ok) throw new Error("Failed to save record");
      setStage("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submit failed";
      setError(message);
      setStage("review");
    }
  };

  const reset = () => {
    setStage("idle");
    setFields(null);
    setTranscript("");
    setTimer(0);
    setError("");
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const updateField = (key: keyof ExtractedFields, value: string) => {
    if (!fields) return;
    setFields({ ...fields, [key]: value });
  };

  const typeOptions = ["Bug", "Change Request", "Upgrade", "Complaint", "Other"];
  const priorityOptions = ["Low", "Medium", "High", "Critical"];

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {stage === "idle" && (
        <div className="flex flex-col items-center">
          <button
            onClick={startRecording}
            className="relative w-28 h-28 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center shadow-lg active:scale-95"
          >
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
          <p className="text-gray-400 text-xs mt-4">Record a client issue</p>
        </div>
      )}

      {stage === "recording" && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-red-400 animate-pulse-ring" />
            <button
              onClick={processAudio}
              className="relative w-28 h-28 rounded-full bg-red-600 flex items-center justify-center shadow-lg z-10"
            >
              <div className="w-10 h-10 rounded-sm bg-white" />
            </button>
          </div>
          <span className="text-2xl font-mono text-gray-700">{formatTime(timer)}</span>
          <canvas
            ref={canvasRef}
            width={320}
            height={80}
            className="w-full max-w-xs rounded-lg bg-gray-50"
          />
        </div>
      )}

      {stage === "processing" && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Processing...</p>
          <p className="text-gray-400 text-sm">Transcribing and extracting fields</p>
        </div>
      )}

      {(stage === "review" || stage === "submitting") && fields && (
        <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
          <h2 className="font-semibold text-lg">Review & Confirm</h2>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client Name</label>
            <input
              type="text"
              value={fields.client_name || ""}
              onChange={(e) => updateField("client_name", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={fields.type || "Other"}
                onChange={(e) => updateField("type", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {typeOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select
                value={fields.priority || "Medium"}
                onChange={(e) => updateField("priority", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {priorityOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Summary</label>
            <input
              type="text"
              value={fields.summary || ""}
              onChange={(e) => updateField("summary", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Full Description</label>
            <textarea
              value={fields.full_description || ""}
              onChange={(e) => updateField("full_description", e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Re-record
            </button>
            <button
              onClick={submitRecord}
              disabled={stage === "submitting"}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {stage === "submitting" ? "Saving..." : "Submit"}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="bg-white rounded-xl shadow-md p-5 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-semibold text-lg">Logged Successfully</h2>
          <p className="text-sm text-gray-500">
            {fields?.client_name} — {fields?.type} ({fields?.priority})
          </p>
          <button
            onClick={reset}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Record Another
          </button>
        </div>
      )}
    </>
  );
}

// ─── Meeting Notes Recorder ───

const meetingPriorityColor: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-orange-100 text-orange-700",
  Low: "bg-gray-100 text-gray-600",
};

function MeetingRecorder() {
  const [stage, setStage] = useState<MeetingStage>("idle");
  const [timer, setTimer] = useState(0);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [attendees, setAttendees] = useState("");
  const [error, setError] = useState("");
  const [processingStep, setProcessingStep] = useState("");
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#3b82f6";
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setStage("recording");
      setTimer(0);

      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
      drawWaveform();
    } catch {
      setError("Could not access microphone. Please allow microphone access.");
    }
  };

  const stopRecording = async (): Promise<Blob> => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) throw new Error("No recorder");

    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    return new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  };

  const processAudio = async () => {
    const recordingDuration = timer;
    setStage("processing");
    setError("");

    try {
      setProcessingStep("Stopping recording...");
      const audioBlob = await stopRecording();

      setProcessingStep("Transcribing audio...");
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const transcribeRes = await fetch("/api/meeting/transcribe", {
        method: "POST",
        body: formData,
        headers: { "x-audio-duration": String(recordingDuration) },
      });
      if (!transcribeRes.ok) {
        const err = await transcribeRes.json().catch(() => ({}));
        throw new Error(err.error || `Transcription failed (${transcribeRes.status})`);
      }
      const { transcript, duration } = await transcribeRes.json();

      setProcessingStep("Generating meeting notes...");
      const summariseRes = await fetch("/api/meeting/summarise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!summariseRes.ok) {
        const err = await summariseRes.json().catch(() => ({}));
        throw new Error(err.error || `Summarisation failed (${summariseRes.status})`);
      }
      const summary: MeetingResult = await summariseRes.json();

      setProcessingStep("Saving to MeetingLog...");
      const logRes = await fetch("/api/meeting/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_title: meetingTitle || "Untitled Meeting",
          attendees,
          date: new Date().toISOString().split("T")[0],
          duration,
          key_notes: summary.key_notes,
          todo_list: summary.todo_list,
          raw_transcript: transcript,
        }),
      });
      if (!logRes.ok) {
        const err = await logRes.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${logRes.status})`);
      }

      setResult(summary);
      setStage("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Processing failed";
      setError(message);
      setStage("idle");
    }
  };

  const copyNotes = async () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`# ${meetingTitle || "Meeting Notes"}`);
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    if (attendees) lines.push(`Attendees: ${attendees}`);
    lines.push("");
    lines.push("## Key Notes");
    result.key_notes.forEach((note) => lines.push(`• ${note}`));
    lines.push("");
    lines.push("## To Do List");
    result.todo_list.forEach((item, i) => {
      lines.push(
        `${i + 1}. [${item.priority}] ${item.task}${item.owner ? ` → ${item.owner}` : ""}`
      );
    });

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStage("idle");
    setResult(null);
    setTimer(0);
    setError("");
    setMeetingTitle("");
    setAttendees("");
    setProcessingStep("");
    setCopied(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* IDLE */}
      {stage === "idle" && (
        <div className="space-y-5">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Meeting Title (optional)"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <input
              type="text"
              placeholder="Attendees (comma separated, optional)"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="flex flex-col items-center pt-2">
            <button
              onClick={startRecording}
              className="relative w-28 h-28 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center shadow-lg active:scale-95"
            >
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <p className="text-gray-400 text-xs mt-4">Record a meeting</p>
          </div>
        </div>
      )}

      {/* RECORDING */}
      {stage === "recording" && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-400 animate-pulse-ring" />
            <button
              onClick={processAudio}
              className="relative w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center shadow-lg z-10"
            >
              <div className="w-10 h-10 rounded-sm bg-white" />
            </button>
          </div>
          <div className="text-center">
            <span className="text-2xl font-mono text-gray-700">{formatTime(timer)}</span>
            <div className="flex items-center gap-2 justify-center mt-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-500 text-xs font-medium">Recording Meeting</span>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            width={320}
            height={80}
            className="w-full max-w-xs rounded-lg bg-gray-50"
          />
          {meetingTitle && (
            <p className="text-gray-400 text-xs">{meetingTitle}</p>
          )}
        </div>
      )}

      {/* PROCESSING */}
      {stage === "processing" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Processing...</p>
          <p className="text-gray-400 text-sm">{processingStep}</p>
        </div>
      )}

      {/* DONE */}
      {stage === "done" && result && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-lg">
                  {meetingTitle || "Meeting Notes"}
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                {attendees && (
                  <p className="text-gray-400 text-sm mt-0.5">{attendees}</p>
                )}
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Key Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Key Notes
            </h3>
            <ul className="space-y-2">
              {result.key_notes.map((note, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-gray-400 flex-shrink-0">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* To Do List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              To Do List
            </h3>
            <ol className="space-y-2">
              {result.todo_list.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-400 font-mono w-5 flex-shrink-0 text-right">
                    {i + 1}.
                  </span>
                  <span className="text-gray-700 flex-1">{item.task}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      meetingPriorityColor[item.priority] || "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {item.priority}
                  </span>
                  {item.owner && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{item.owner}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={copyNotes}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Notes
                </>
              )}
            </button>
            <button
              onClick={reset}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              New Meeting
            </button>
          </div>
        </div>
      )}
    </>
  );
}
