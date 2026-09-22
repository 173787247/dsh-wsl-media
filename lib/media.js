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
  for (const b of ["ffprobe", "ffmpeg", "pdftotext", "whisper", "whisper-cpp", "whisper.cpp"]) {
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
