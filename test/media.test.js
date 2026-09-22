import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSafePath } from "../lib/media.js";
import { homedir } from "node:os";
import { join } from "node:path";

describe("assertSafePath", () => {
  it("allows home file path shape", () => {
    const p = join(homedir(), "no-such-but-under-home.txt");
    const out = assertSafePath(p, [homedir()]);
    assert.ok(out.includes(homedir()) || out.startsWith("/"));
  });
  it("rejects outside roots", () => {
    assert.throws(() => assertSafePath("/etc/passwd", [homedir()]), /outside/);
  });
});
