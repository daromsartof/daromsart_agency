import { createFsStorage } from "./fs";
import { createS3Storage } from "./s3";
import type { Storage } from "./types";

/** Sous-ensemble des variables d'environnement consommées par le storage. */
export interface StorageEnv {
  STORAGE_DRIVER: "fs" | "s3";
  STORAGE_BUCKET?: string;
  STORAGE_ENDPOINT?: string;
  STORAGE_REGION?: string;
  STORAGE_ACCESS_KEY_ID?: string;
  STORAGE_SECRET_ACCESS_KEY?: string;
  STORAGE_PUBLIC_URL?: string;
}

/** Construit le driver de stockage à partir de l'environnement validé de l'app. */
export function createStorage(env: StorageEnv): Storage {
  if (env.STORAGE_DRIVER === "fs") {
    return createFsStorage({ driver: "fs" });
  }

  if (!env.STORAGE_BUCKET || !env.STORAGE_ACCESS_KEY_ID || !env.STORAGE_SECRET_ACCESS_KEY) {
    throw new Error(
      "STORAGE_DRIVER=s3 requiert STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID et STORAGE_SECRET_ACCESS_KEY.",
    );
  }

  return createS3Storage({
    driver: "s3",
    bucket: env.STORAGE_BUCKET,
    region: env.STORAGE_REGION ?? "auto",
    endpoint: env.STORAGE_ENDPOINT || undefined,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    publicUrl: env.STORAGE_PUBLIC_URL || undefined,
  });
}
