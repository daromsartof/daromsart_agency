import type { getOrg } from "@/modules/organization/queries";

export type Organization = Awaited<ReturnType<typeof getOrg>>;
