import { describe, expect, it } from "vitest";
import { renderEmailVariables } from "./email-vars";

describe("renderEmailVariables", () => {
  it("substitue toutes les variables reconnues", () => {
    const result = renderEmailVariables(
      "Bonjour {client}, voici le devis {numero} d'un montant de {total}. Lien : {lien}. Échéance : {echeance}.",
      {
        client: "Nova Digital",
        numero: "DEV-2026-0001",
        total: "1 200,00 €",
        lien: "https://app.example.com/p/devis/abc",
        echeance: "15/08/2026",
      },
    );
    expect(result).toBe(
      "Bonjour Nova Digital, voici le devis DEV-2026-0001 d'un montant de 1 200,00 €. Lien : https://app.example.com/p/devis/abc. Échéance : 15/08/2026.",
    );
  });

  it("laisse une variable manquante telle quelle (pas de crash)", () => {
    const result = renderEmailVariables("Bonjour {client}, total {total}.", {
      client: "Nova Digital",
    });
    expect(result).toBe("Bonjour Nova Digital, total {total}.");
  });

  it("laisse un token non reconnu inchangé", () => {
    const result = renderEmailVariables("Bonjour {inconnu}.", { client: "X" });
    expect(result).toBe("Bonjour {inconnu}.");
  });

  it("ne fait rien sur un texte sans variable", () => {
    expect(renderEmailVariables("Texte fixe.", {})).toBe("Texte fixe.");
  });

  it("substitue plusieurs occurrences de la même variable", () => {
    expect(renderEmailVariables("{client} - {client}", { client: "X" })).toBe("X - X");
  });
});
