import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const collectTypeScriptFiles = (directory: string): string[] => {
	return readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			return collectTypeScriptFiles(path);
		}

		return entry.isFile() && /\.(ts|tsx)$/.test(path)
			? [
					path,
				]
			: [];
	});
};

describe("source isolation", () => {
	it("keeps tests and test-only imports outside active source roots", () => {
		const invalidFiles = [
			"src/engine",
			"src/ui",
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
