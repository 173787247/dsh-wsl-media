import {
  mediaStatus,
  ffprobeFile,
  pdfText,
  asrTranscribe,
  extractAudio,
  thumbnail,
  pandocConvert,
  tesseractOcr,
  exifMeta,
} from "./lib/media.js";

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
    text: "dsh-wsl-media inspects/converts local media under allowlisted roots. Tools: probe, extract_audio, thumbnail, pdf_text, asr, pandoc, tesseract, exif. Prefer absolute Linux paths. Check media_status for CLIs.",
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

  ctx.tools.register({
    name: "media_extract_audio",
    description: "ffmpeg: extract mono 16kHz WAV from video/audio into outPath under allowRoots.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path", "outPath"],
      properties: { path: { type: "string" }, outPath: { type: "string" } },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : `ok out=${v.out}` }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await extractAudio(args.path, args.outPath, opts);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "extract audio" }),
    presentResult: (_a, r) => ({ card: "generic", title: "extract audio", content: r.content }),
  });

  ctx.tools.register({
    name: "media_thumbnail",
    description: "ffmpeg: grab one frame as image into outPath.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path", "outPath"],
      properties: {
        path: { type: "string" },
        outPath: { type: "string" },
        timeSec: { type: "number" },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : `ok out=${v.out}` }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await thumbnail(args.path, args.outPath, { ...opts, timeSec: args.timeSec });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "thumbnail" }),
    presentResult: (_a, r) => ({ card: "generic", title: "thumbnail", content: r.content }),
  });

  ctx.tools.register({
    name: "media_pandoc",
    description: "pandoc convert under allowRoots (md/html/docx/plain). Optional outPath; else return text.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path", "to"],
      properties: {
        path: { type: "string" },
        to: { type: "string" },
        outPath: { type: "string" },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : v.text || `ok out=${v.out}` }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await pandocConvert(args.path, args.to, args.outPath, opts);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "pandoc" }),
    presentResult: (_a, r) => ({ card: "generic", title: "pandoc", content: r.content }),
  });

  ctx.tools.register({
    name: "media_ocr",
    description: "tesseract OCR on an image under allowRoots.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: { path: { type: "string" }, lang: { type: "string" } },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : v.text || "" }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await tesseractOcr(args.path, { ...opts, lang: args.lang });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "OCR" }),
    presentResult: (_a, r) => ({ card: "generic", title: "OCR", content: r.content }),
  });

  ctx.tools.register({
    name: "media_exif",
    description: "exiftool JSON metadata for a local file.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: { path: { type: "string" } },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : JSON.stringify(v.meta, null, 2) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await exifMeta(args.path, opts);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "exif" }),
    presentResult: (_a, r) => ({ card: "generic", title: "exif", content: r.content }),
  });
}

function positive(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}
