import { storage } from "@/lib/storage";
import { getOrg } from "@/modules/organization/queries";
import { AddressCard } from "./address-card";
import { BankCard } from "./bank-card";
import { IdentityCard } from "./identity-card";
import { LegalFooterCard } from "./legal-footer-card";
import { LogoCard } from "./logo-card";

export const metadata = { title: "Entreprise" };

export default async function EntreprisePage() {
  const org = await getOrg();
  const logoUrl = org.logoKey ? await storage.getSignedUrl(org.logoKey) : null;

  return (
    <div className="space-y-6">
      <LogoCard logoUrl={logoUrl} hasLogo={Boolean(org.logoKey)} />
      <IdentityCard org={org} />
      <AddressCard org={org} />
      <BankCard org={org} />
      <LegalFooterCard org={org} />
    </div>
  );
}
