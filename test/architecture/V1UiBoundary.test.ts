import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve("src/v1");

const readFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory()
			? readFiles(path)
			: [
					path,
				];
	});

describe("v1 UI boundary", () => {
	it("keeps React imports inside src/v1/ui", () => {
		const offenders = readFiles(root)
			.filter((path) => /\.(ts|tsx)$/.test(path))
			.filter((path) => !relative(root, path).startsWith("ui/"))
			.filter((path) => /from ["']react(?:\/[^"']*)?["']/.test(readFileSync(path, "utf8")))
			.map((path) => relative(root, path));

		expect(offenders).toEqual([]);
	});

	it("keeps core v1 code independent from UI adapters", () => {
		const offenders = readFiles(root)
			.filter((path) => /\.(ts|tsx)$/.test(path))
			.filter((path) => !relative(root, path).startsWith("ui/"))
			.filter((path) => /~\/v1\/ui\//.test(readFileSync(path, "utf8")))
			.map((path) => relative(root, path));

		expect(offenders).toEqual([]);
	});
});
