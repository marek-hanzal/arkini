import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSourceFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readSourceFiles(path);
		return /\.tsx?$/.test(entry.name)
			? [
					path,
				]
			: [];
	});

describe("item detail scroll contract", () => {
	it("keeps scroll ownership on the sheet instead of nested detail panels", () => {
		const sources = readSourceFiles("src/v0/item-detail/ui")
			.map((path) => ({
				path,
				source: readFileSync(path, "utf8"),
			}))
			.filter(({ path }) => !path.endsWith("itemDetailScrollContract.test.ts"));

		for (const { path, source } of sources) {
			expect(source, `${path} must not own vertical scrolling`).not.toContain(
				"overflow-y-auto",
			);
			expect(source, `${path} must not own horizontal scrolling`).not.toContain(
				"overflow-x-auto",
			);
			expect(source, `${path} must not own scrollbar styling`).not.toContain(
				"scrollbar-width",
			);
		}
	});
});
