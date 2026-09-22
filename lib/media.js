import { spawn } from "node:child_process";
import { realpathSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, normalize } from "node:path";

export function which(cmd) {
  return new Promise((resolvePromise) => {
    const child = spawn("bash", ["-lc", `command -v ${cmd}`], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) => resolvePromise(code === 0 ? out.trim() : ""));
  });
}

export function assertSafePath(filePath, allowRoots = []) {
  const raw = String(filePath || "").trim();
  if (!raw) throw new Error("path required");
  if (raw.includes("\0")) throw new Error("invalid path");
  const abs = resolve(raw);
  const real = existsSync(abs) ? realpathSync(abs) : abs;
  const roots = (allowRoots.length ? allowRoots : defaultRoots()).map((r) => {
    const a = resolve(r);
    return existsSync(a) ? realpathSync(a) : a;
  });
  const ok = roots.some((root) => isUnderRoot(real, root));
  if (!ok) throw new Error(`path outside allowRoots: ${real}`);
  return real;
}

function isUnderRoot(real, root) {
  const r = root.replace(/[/\\]+$/, "");
  if (process.platform === "win32") {
    const a = real.toLowerCase();
    const b = r.toLowerCase();
    return a === b || a.startsWith(b + "\\") || a.startsWith(b + "/");
  }
  return real === r || real.startsWith(r + "/");
}

function defaultRoots() {
  const home = homedir();
  return [home, resolve(home, ".dsh"), "/tmp", "/mnt/c", "/mnt/d"].filter((p) => existsSync(p));
}

export function runCmd(bin, args, { timeoutMs = 60_000, maxOut = 2_000_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`timeout ${timeoutMs}ms: ${bin}`));
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout = Buffer.concat([stdout, d]);
      if (stdout.length > maxOut) child.kill("SIGKILL");
    });
    child.stderr.on("data", (d) => {
      stderr = Buffer.concat([stderr, d]);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({
        code,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8").slice(0, 4000),
      });
    });
  });
}

export async function mediaStatus() {
  const bins = {};
  for (const b of [
    "ffprobe",
    "ffmpeg",
    "pdftotext",
    "whisper",
    "whisper-cpp",
    "whisper.cpp",
    "pandoc",
    "tesseract",
    "exiftool",
  ]) {
    bins[b] = (await which(b)) || null;
  }
  return { ok: true, bins };
}

export async function ffprobeFile(path, { allowRoots, timeoutMs } = {}) {
  const file = assertSafePath(path, allowRoots);
  const bin = (await which("ffprobe")) || "ffprobe";
  const { code, stdout, stderr } = await runCmd(
    bin,
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file],
    { timeoutMs },
  );
  if (code !== 0) throw new Error(`ffprobe failed: ${stderr || code}`);
  return { ok: true, path: file, probe: JSON.parse(stdout || "{}") };
}

export async function pdfText(path, { allowRoots, timeoutMs, maxChars = 100_000 } = {}) {
  const file = assertSafePath(path, allowRoots);
  if (!/\.pdf$/i.test(file)) throw new Error("pdf_text: expect .pdf");
  const bin = (await which("pdftotext")) || "pdftotext";
  const { code, stdout, stderr } = await runCmd(bin, ["-layout", "-nopgbrk", file, "-"], { timeoutMs });
  if (code !== 0) throw new Error(`pdftotext failed: ${stderr || code}`);
  const text = String(stdout || "");
  return {
    ok: true,
    path: file,
    chars: text.length,
    truncated: text.length > maxChars,
    text: text.slice(0, maxChars),
  };
}

export async function asrTranscribe(path, { allowRoots, timeoutMs, language } = {}) {
  const file = assertSafePath(path, allowRoots);
  const st = statSync(file);
  if (st.size > 100 * 1024 * 1024) throw new Error("asr: file > 100MB refused");
  let bin = await which("whisper");
  let args;
  if (bin) {
    args = [file, "--output_format", "txt", "--output_dir", "/tmp"];
    if (language) args.push("--language", language);
  } else {
    bin = (await which("whisper-cpp")) || (await which("whisper.cpp"));
    if (!bin) throw new Error("asr: no whisper / whisper-cpp on PATH");
    args = ["-f", file];
    if (language) args.push("-l", language);
  }
  const { code, stdout, stderr } = await runCmd(bin, args, { timeoutMs: timeoutMs || 300_000, maxOut: 5_000_000 });
  if (code !== 0) throw new Error(`asr failed: ${stderr || code}`);
  return { ok: true, path: file, text: String(stdout || "").trim(), stderr: stderr.slice(0, 500) };
}

export async function extractAudio(path, outPath, { allowRoots, timeoutMs } = {}) {
  const file = assertSafePath(path, allowRoots);
  const out = assertSafePath(outPath, allowRoots);
  if (!/\.(wav|mp3|m4a|flac|ogg)$/i.test(out)) throw new Error("extract_audio: out must be audio extension");
  const bin = (await which("ffmpeg")) || "ffmpeg";
  const { code, stderr } = await runCmd(
    bin,
    ["-y", "-i", file, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", out],
    { timeoutMs: timeoutMs || 120_000 },
  );
  if (code !== 0) throw new Error(`ffmpeg extract failed: ${stderr || code}`);
  return { ok: true, path: file, out };
}

export async function thumbnail(path, outPath, { allowRoots, timeoutMs, timeSec = 1 } = {}) {
  const file = assertSafePath(path, allowRoots);
  const out = assertSafePath(outPath, allowRoots);
  if (!/\.(jpg|jpeg|png|webp)$/i.test(out)) throw new Error("thumbnail: out must be image extension");
  const bin = (await which("ffmpeg")) || "ffmpeg";
  const ss = Math.max(0, Number(timeSec) || 1);
  const { code, stderr } = await runCmd(
    bin,
    ["-y", "-ss", String(ss), "-i", file, "-frames:v", "1", "-q:v", "2", out],
    { timeoutMs: timeoutMs || 60_000 },
  );
  if (code !== 0) throw new Error(`ffmpeg thumbnail failed: ${stderr || code}`);
  return { ok: true, path: file, out, timeSec: ss };
}

export async function pandocConvert(path, to, outPath, { allowRoots, timeoutMs, maxOut = 200_000 } = {}) {
  const file = assertSafePath(path, allowRoots);
  const fmt = String(to || "").trim().toLowerCase();
  if (!/^(markdown|md|html|docx|plain|gfm)$/.test(fmt)) throw new Error("pandoc: unsupported to format");
  const bin = (await which("pandoc")) || "pandoc";
  if (outPath) {
    const out = assertSafePath(outPath, allowRoots);
    const { code, stderr } = await runCmd(bin, ["-f", "auto", "-t", fmt === "md" ? "markdown" : fmt, "-o", out, file], {
      timeoutMs,
    });
    if (code !== 0) throw new Error(`pandoc failed: ${stderr || code}`);
    return { ok: true, path: file, out, to: fmt };
  }
  const { code, stdout, stderr } = await runCmd(bin, ["-f", "auto", "-t", fmt === "md" ? "markdown" : fmt, file], {
    timeoutMs,
    maxOut,
  });
  if (code !== 0) throw new Error(`pandoc failed: ${stderr || code}`);
  const text = String(stdout || "");
  return { ok: true, path: file, to: fmt, truncated: text.length >= maxOut, text: text.slice(0, maxOut) };
}

export async function tesseractOcr(path, { allowRoots, timeoutMs, lang = "eng", maxOut = 100_000 } = {}) {
  const file = assertSafePath(path, allowRoots);
  const bin = (await which("tesseract")) || "tesseract";
  const langSafe = String(lang || "eng").replace(/[^a-zA-Z0-9+_]/g, "");
  const { code, stdout, stderr } = await runCmd(bin, [file, "stdout", "-l", langSafe], { timeoutMs, maxOut });
  if (code !== 0) throw new Error(`tesseract failed: ${stderr || code}`);
  const text = String(stdout || "");
  return { ok: true, path: file, lang: langSafe, truncated: text.length >= maxOut, text: text.slice(0, maxOut) };
}

export async function exifMeta(path, { allowRoots, timeoutMs, maxOut = 40_000 } = {}) {
  const file = assertSafePath(path, allowRoots);
  const bin = (await which("exiftool")) || "exiftool";
  const { code, stdout, stderr } = await runCmd(bin, ["-json", "-n", file], { timeoutMs, maxOut });
  if (code !== 0) throw new Error(`exiftool failed: ${stderr || code}`);
  let meta;
  try {
    meta = JSON.parse(stdout || "[]");
  } catch {
    throw new Error("exiftool: non-JSON output");
  }
  return { ok: true, path: file, meta: Array.isArray(meta) ? meta[0] || {} : meta };
}
