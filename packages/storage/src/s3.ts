import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import type { S3StorageConfig, Storage } from "./types";

const DEFAULT_EXPIRES_SECONDS = 3600;

/** Driver S3 (compatible AWS S3, Cloudflare R2, MinIO via `endpoint`). */
export function createS3Storage(config: S3StorageConfig): Storage {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    // Requis par la plupart des endpoints S3-compatibles hors AWS.
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
    async get(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        const body = result.Body;
        if (!body) return null;
        const chunks: Uint8Array[] = [];
        for await (const chunk of body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } catch (err) {
        if ((err as { name?: string }).name === "NoSuchKey") return null;
        throw err;
      }
    },
    async getSignedUrl(key, expiresInSeconds = DEFAULT_EXPIRES_SECONDS) {
      if (config.publicUrl) {
        return `${config.publicUrl.replace(/\/$/, "")}/${key}`;
      }
      return presign(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    },
    async delete(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    },
  };
}
