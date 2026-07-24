import { db } from "@/db";
import { requireAdmin } from "@/modules/auth/session";
import { getOrg } from "@/modules/organization/queries";
import { getCurrentSequenceStatus } from "@/modules/organization/sequence-status";
import { NumberFormatsCard } from "./number-formats-card";
import { VatCard } from "./vat-card";
import { DelaysCard } from "./delays-card";

export const metadata = { title: "Facturation" };

export default async function FacturationPage() {
  await requireAdmin();
  const org = await getOrg();
  const sequenceStatus = await getCurrentSequenceStatus(db, org.id);

  return (
    <div className="space-y-6">
      <NumberFormatsCard formats={org.numberFormats} sequenceStatus={sequenceStatus} />
      <VatCard
        activeRates={org.vatRatesActive}
        defaultRate={Number(org.vatRateDefault)}
        franchiseEnabled={org.franchiseEnabled}
      />
      <DelaysCard
        paymentTermsDays={org.paymentTermsDays}
        quoteValidityDays={org.quoteValidityDays}
      />
    </div>
  );
}
