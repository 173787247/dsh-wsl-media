import { mediaStatus, ffprobeFile, pdfText, asrTranscribe, assertSafePath } from "./lib/media.js";

export const name = "dsh-wsl-media";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  if (config.enabled === false) {
    console.log("[dsh-wsl-media] disabled");
    return;
  }
  const timeoutMs = positive(config.timeoutMs, 120_000);
  const maxPdfChars = positive(config.maxPdfChars, 100_000);
  const allowRoots = Array.isArray(config.allowRoots) ? config.allowRoots.map(String) : [];
  console.log(`[dsh-wsl-media] timeoutMs=${timeoutMs} allowRoots=${allowRoots.length || "defaults"}`);

  ctx.systemPrompt.section({
    name: "tool:media",
    order: 129,
    text: "dsh-wsl-media inspects local media under allowlisted roots (home, ~/.dsh, /tmp, /mnt/c|d). Use media_status for available CLIs. Prefer absolute Linux paths. ASR needs whisper on PATH.",
  });

  const opts = { allowRoots, timeoutMs, maxChars: maxPdfChars };

  ctx.tools.register({
    name: "media_status",
    description: "Report which media CLIs are on PATH (ffprobe/ffmpeg/pdftotext/whisper).",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: JSON.stringify(v, null, 2) }] },
    timeoutMs: 10_000,
    isConcurrencySafe: () => true,
    async execute() {
      return mediaStatus();
    },
    presentCall: () => ({ card: "generic", title: "Media status" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Media status", content: r.content }),
  });

  ctx.tools.register({
    name: "media_probe",
    description: "ffprobe JSON for a local audio/video/image file.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: { path: { type: "string" } },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : JSON.stringify(v.probe?.format || v, null, 2) }] },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await ffprobeFile(args.path, opts);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "Media probe" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Media probe", content: r.content }),
  });

  ctx.tools.register({
    name: "media_pdf_text",
    description: "Extract text from a PDF via pdftotext.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: { path: { type: "string" } },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : v.text || "" }] },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await pdfText(args.path, opts);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "PDF text" }),
    presentResult: (_a, r) => ({ card: "generic", title: "PDF text", content: r.content }),
  });

  ctx.tools.register({
    name: "media_asr",
    description: "Transcribe local audio with whisper CLI if installed (slow; large files refused).",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string" },
        language: { type: "string" },
      },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : v.text || "" }] },
    timeoutMs: Math.max(timeoutMs, 300_000),
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await asrTranscribe(args.path, { ...opts, language: args.language });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "ASR" }),
    presentResult: (_a, r) => ({ card: "generic", title: "ASR", content: r.content }),
  });

  // silence unused import lint
  void assertSafePath;
}

function positive(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}
