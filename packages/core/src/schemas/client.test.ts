import { describe, expect, it } from "vitest";
import { clientSchema } from "./client";

describe("clientSchema", () => {
  it("accepte une société valide", () => {
    const result = clientSchema.safeParse({
      type: "company",
      displayName: "Atelier Lumière SARL",
      addressCountry: "France",
      addressZip: "75001",
      email: "contact@atelier.fr",
      contacts: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepte un particulier valide sans champs société", () => {
    const result = clientSchema.safeParse({
      type: "individual",
      displayName: "Jean Petit",
      addressCountry: "France",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un nom vide", () => {
    const result = clientSchema.safeParse({
      type: "company",
      displayName: "",
      addressCountry: "France",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un email invalide", () => {
    const result = clientSchema.safeParse({
      type: "individual",
      displayName: "Jean Petit",
      email: "pas-un-email",
      addressCountry: "France",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un code postal français invalide", () => {
    const result = clientSchema.safeParse({
      type: "individual",
      displayName: "Jean Petit",
      addressCountry: "France",
      addressZip: "ABC12",
    });
    expect(result.success).toBe(false);
  });

  it("n'applique pas la validation du CP France pour un autre pays", () => {
    const result = clientSchema.safeParse({
      type: "individual",
      displayName: "John Doe",
      addressCountry: "Belgique",
      addressZip: "B-1000",
    });
    expect(result.success).toBe(true);
  });

  it("valide un tableau de contacts", () => {
    const result = clientSchema.safeParse({
      type: "company",
      displayName: "Nova Digital",
      addressCountry: "France",
      contacts: [
        { name: "Sophie Martin", email: "sophie@nova.io", role: "Achats" },
        { name: "", email: "invalid" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
