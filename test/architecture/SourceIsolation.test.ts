import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const collectTypeScriptFiles = (path: string): string[] => {
	if (!statSync(path).isDirectory()) {
		return /\.(ts|tsx)$/.test(path)
			? [
					path,
				]
			: [];
	}

	return readdirSync(path, {
		withFileTypes: true,
	}).flatMap((entry) => collectTypeScriptFiles(join(path, entry.name)));
};

describe("source isolation", () => {
	it("keeps tests and test-only imports outside active source roots", () => {
		const invalidFiles = [
			"src/engine",
			"src/bridge",
			"src/ui",
			"src/page",
			"src/@routes",
			"src/main.tsx",
			"src/router.tsx",
		]
			.flatMap(collectTypeScriptFiles)
			.filter((path) => {
				const source = readFileSync(path, "utf8");

				return (
					/\.(test|spec)\.(ts|tsx)$/.test(path) ||
					source.includes('from "~test/') ||
					source.includes('from "vitest"')
				);
			});

		expect(invalidFiles).toEqual([]);
	});
});
