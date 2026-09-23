import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { readInlinedChangelog } from "./scripts/inline-changelog.mjs";

export default defineConfig({
	// Same injection as esbuild.config.mjs
	define: { LIFTOFF_CHANGELOG: JSON.stringify(readInlinedChangelog()) },
	test: {
		include: ["tests/**/*.test.ts"],
	},
	resolve: {
		alias: {
			obsidian: fileURLToPath(new URL("./tests/mocks/obsidian.ts", import.meta.url)),
		},
	},
});
