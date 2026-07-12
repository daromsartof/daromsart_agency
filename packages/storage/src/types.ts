/** Abstraction de stockage de fichiers (logos, PDF signés, images de signature). */
export interface Storage {
  /** Écrit un objet et renvoie sa clé. */
  put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  /** URL permettant de lire l'objet (signée en s3, route locale en fs). */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /** Supprime l'objet (idempotent : ne lève pas si absent). */
  delete(key: string): Promise<void>;
}

export interface FsStorageConfig {
  driver: "fs";
  /** Répertoire racine sur le disque (défaut `.storage`). */
  basePath?: string;
  /** Préfixe d'URL servi par l'app en dev (défaut `/api/storage`). */
  publicPath?: string;
}

export interface S3StorageConfig {
  driver: "s3";
  bucket: string;
  region: string;
  /** Endpoint personnalisé (Cloudflare R2, MinIO…). Optionnel pour AWS. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base d'URL publique (CDN) ; si absente, on renvoie une URL signée. */
  publicUrl?: string;
}

export type StorageConfig = FsStorageConfig | S3StorageConfig;
