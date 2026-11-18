// BadgeRepository adapter: one JSON file per badge plus the directory index; atomic writes.

import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BadgeRepository } from "../application/ports.ts";
import type { Badge } from "../domain/badge.ts";
import { entryFor, withEntry, type DirectoryEntry } from "../domain/directory.ts";

const ID = /^[A-Za-z0-9_-]{22}$/;

export class FileBadgeRepository implements BadgeRepository {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async init(): Promise<void> {
    await mkdir(path.join(this.dir, "badges"), { recursive: true });
  }

  private async atomicWrite(file: string, text: string): Promise<void> {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, text, { mode: 0o644 });
    await rename(tmp, file);
  }

  async save(badge: Badge): Promise<void> {
    if (!ID.test(badge.id)) throw new Error("Invalid badge id");
    await this.atomicWrite(path.join(this.dir, "badges", `${badge.id}.json`), `${JSON.stringify(badge, null, 2)}\n`);
    const next = withEntry(await this.directory(), entryFor(badge));
    await this.atomicWrite(path.join(this.dir, "directory.json"), `${JSON.stringify(next, null, 2)}\n`);
  }

  async get(id: string): Promise<Badge | null> {
    if (!ID.test(id)) return null;
    try {
      return JSON.parse(await readFile(path.join(this.dir, "badges", `${id}.json`), "utf8")) as Badge;
    } catch {
      return null;
    }
  }

  async directory(): Promise<DirectoryEntry[]> {
    try {
      return JSON.parse(await readFile(path.join(this.dir, "directory.json"), "utf8")) as DirectoryEntry[];
    } catch {
      return [];
    }
  }

  async count(): Promise<number> {
    try {
      return (await readdir(path.join(this.dir, "badges"))).filter((f) => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }
}
