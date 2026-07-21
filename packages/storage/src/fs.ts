import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { FsStorageConfig, Storage } from "./types";

/**
 * Driver système de fichiers pour le développement. Les objets sont écrits sous
 * `basePath` ; les URLs pointent vers une route de l'app (`publicPath/{key}`)
 * qui relit le fichier. Pas de signature en dev (inutile localement).
 */
export function createFsStorage(config: FsStorageConfig): Storage {
  const basePath = resolve(config.basePath ?? ".storage");
  const publicPath = (config.publicPath ?? "/api/storage").replace(/\/$/, "");

  /** Empêche toute évasion hors de `basePath` (path traversal). */
  function resolveKey(key: string): string {
    const target = resolve(join(basePath, key));
    if (target !== basePath && !target.startsWith(basePath + sep)) {
      throw new Error(`Clé de stockage invalide : ${key}`);
    }
    return target;
  }

  return {
    async put(key, body, _contentType) {
      const target = resolveKey(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
    },
    async get(key) {
      try {
        return await readFile(resolveKey(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async getSignedUrl(key) {
      // Normalise les séparateurs pour l'URL.
      const urlKey = key.split(sep).join("/");
      return `${publicPath}/${urlKey}`;
    },
    async delete(key) {
      await rm(resolveKey(key), { force: true });
    },
  };
}
