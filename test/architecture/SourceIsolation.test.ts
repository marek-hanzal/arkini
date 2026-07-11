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

		return entry.isFile() && path.endsWith(".ts")
			? [
					path,
				]
			: [];
	});
};

describe("source isolation", () => {
	it("keeps tests and test-only imports outside src/v1", () => {
		const invalidFiles = collectTypeScriptFiles("src/v1").filter((path) => {
			const source = readFileSync(path, "utf8");

			return (
				path.endsWith(".test.ts") ||
				path.endsWith(".spec.ts") ||
				source.includes('from "~test/') ||
				source.includes('from "vitest"')
			);
		});

		expect(invalidFiles).toEqual([]);
	});
});
