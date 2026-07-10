import type { Config } from "tailwindcss";
import { daromsartPreset } from "@daromsart/theme";

const config: Config = {
  presets: [daromsartPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    // IMPORTANT : scanner les sources du design system, sinon purge des classes.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
