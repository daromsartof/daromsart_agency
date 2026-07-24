import { DEFAULT_EMAIL_DEFAULTS } from "@/db/schema";
import { requireAdmin } from "@/modules/auth/session";
import { getOrg } from "@/modules/organization/queries";
import { EmailsClient } from "./emails-client";

export const metadata = { title: "Emails" };

export default async function EmailsPage() {
  await requireAdmin();
  const org = await getOrg();

  return (
    <EmailsClient
      replyTo={org.emailReplyTo ?? ""}
      emailDefaults={org.emailDefaults}
      defaults={DEFAULT_EMAIL_DEFAULTS}
    />
  );
}
