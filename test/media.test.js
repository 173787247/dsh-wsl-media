import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSafePath, defaultRoots } from "../lib/media.js";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

describe("defaultRoots", () => {
  it("lists home and .dsh paths; includes im-workspace when present", () => {
    const roots = defaultRoots();
    assert.ok(roots.includes(homedir()) || roots.some((r) => r.endsWith(homedir())));
    const im = join(homedir(), ".dsh", "im-workspace");
    if (existsSync(im)) {
      assert.ok(roots.some((r) => r === im || r.endsWith(join(".dsh", "im-workspace"))));
    }
  });
});

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
