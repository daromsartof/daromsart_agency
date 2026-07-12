import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStorage } from "./fs";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "daromsart-storage-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createFsStorage", () => {
  it("écrit, lit (URL) et supprime un objet", async () => {
    const storage = createFsStorage({ driver: "fs", basePath: dir });

    await storage.put("logos/org-1.png", Buffer.from("fake-png"), "image/png");
    const content = await readFile(join(dir, "logos/org-1.png"));
    expect(content.toString()).toBe("fake-png");

    const url = await storage.getSignedUrl("logos/org-1.png");
    expect(url).toBe("/api/storage/logos/org-1.png");

    await storage.delete("logos/org-1.png");
    await expect(readFile(join(dir, "logos/org-1.png"))).rejects.toThrow();
  });

  it("supprime silencieusement une clé absente", async () => {
    const storage = createFsStorage({ driver: "fs", basePath: dir });
    await expect(storage.delete("absent.png")).resolves.toBeUndefined();
  });

  it("rejette une clé qui tente une évasion (path traversal)", async () => {
    const storage = createFsStorage({ driver: "fs", basePath: dir });
    await expect(
      storage.put("../evasion.png", Buffer.from("x"), "image/png"),
    ).rejects.toThrow();
  });
});
