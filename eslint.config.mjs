import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Installed agent skills and their mockup output — third-party tooling, not ours.
      ".claude/**",
      ".superpowers/**",
      // Mirrors the schema in db/migrations. The schema decides its shape, not our style rules.
      "lib/database.types.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];

export default eslintConfig;
