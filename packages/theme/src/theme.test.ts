import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { daromsartPreset } from "./tailwind-preset";

describe("daromsartPreset", () => {
  it("expose les couleurs de marque et sémantiques", () => {
    const colors = daromsartPreset.theme?.extend?.colors as Record<
      string,
      unknown
    >;
    expect(colors).toBeDefined();
    for (const key of [
      "primary",
      "secondary",
      "success",
      "warning",
      "destructive",
      "info",
      "muted",
      "border",
    ]) {
      expect(colors[key], `couleur manquante: ${key}`).toBeDefined();
    }
  });

  it("active le dark mode par classe", () => {
    expect(daromsartPreset.darkMode).toEqual(["class"]);
  });

  it("mappe le rayon sur la variable --radius", () => {
    const radius = daromsartPreset.theme?.extend?.borderRadius as Record<
      string,
      string
    >;
    expect(radius.lg).toBe("var(--radius)");
  });
});

describe("tokens.css", () => {
  const css = readFileSync(
    fileURLToPath(new URL("./tokens.css", import.meta.url)),
    "utf8",
  );

  it("définit les thèmes clair (:root) et sombre (.dark)", () => {
    expect(css).toContain(":root");
    expect(css).toContain(".dark");
  });

  it("déclare les variables clés dans les deux thèmes", () => {
    const rootBlock = css.slice(css.indexOf(":root"), css.indexOf(".dark"));
    const darkBlock = css.slice(css.indexOf(".dark"));
    for (const token of ["--primary", "--background", "--foreground"]) {
      expect(rootBlock, `${token} absent de :root`).toContain(token);
      expect(darkBlock, `${token} absent de .dark`).toContain(token);
    }
  });
});
