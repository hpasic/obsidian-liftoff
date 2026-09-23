import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

export default defineConfig({
	// Same injection as esbuild.config.mjs
	define: { LIFTOFF_CHANGELOG: JSON.stringify(readFileSync("CHANGELOG.md", "utf8")) },
	test: {
		include: ["tests/**/*.test.ts"],
	},
	resolve: {
		alias: {
			obsidian: fileURLToPath(new URL("./tests/mocks/obsidian.ts", import.meta.url)),
		},
	},
});
