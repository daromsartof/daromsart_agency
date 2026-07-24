import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "../../db/types";
import { qrCodes, type QrDesignJson, type QrFormValuesJson } from "../../db/schema";
import type { QrContentType } from "@daromsart/qr";

export interface QrCodeRow {
  id: string;
  name: string;
  contentType: QrContentType;
  formValues: QrFormValuesJson;
  design: QrDesignJson;
  payload: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listQrCodes(
  db: AppDb,
  organizationId: string,
): Promise<QrCodeRow[]> {
  const rows = await db
    .select({
      id: qrCodes.id,
      name: qrCodes.name,
      contentType: qrCodes.contentType,
      formValues: qrCodes.formValues,
      design: qrCodes.design,
      payload: qrCodes.payload,
      createdAt: qrCodes.createdAt,
      updatedAt: qrCodes.updatedAt,
    })
    .from(qrCodes)
    .where(eq(qrCodes.organizationId, organizationId))
    .orderBy(desc(qrCodes.updatedAt));

  return rows as QrCodeRow[];
}

export async function getQrCodeById(
  db: AppDb,
  organizationId: string,
  id: string,
): Promise<QrCodeRow | null> {
  const [row] = await db
    .select({
      id: qrCodes.id,
      name: qrCodes.name,
      contentType: qrCodes.contentType,
      formValues: qrCodes.formValues,
      design: qrCodes.design,
      payload: qrCodes.payload,
      createdAt: qrCodes.createdAt,
      updatedAt: qrCodes.updatedAt,
    })
    .from(qrCodes)
    .where(and(eq(qrCodes.organizationId, organizationId), eq(qrCodes.id, id)))
    .limit(1);

  return (row as QrCodeRow | undefined) ?? null;
}
