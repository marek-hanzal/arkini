import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readTypeScriptFiles(path);
		return entry.isFile() && /\.(ts|tsx)$/.test(entry.name)
			? [
					path,
				]
			: [];
	});

describe("bridge operation grammar", () => {
	it("keeps each exported operation in its same-named domain file", () => {
		const root = resolve("src/bridge");
		const violations: string[] = [];

		for (const file of readTypeScriptFiles(root)) {
			const fileName = basename(file).replace(/\.tsx?$/, "");
			const source = readFileSync(file, "utf8");
			const operations = [
				...source.matchAll(/export\s+(?:const|function)\s+([A-Za-z][A-Za-z0-9_]*)\b/g),
			].map((match) => match[1]);

			for (const operation of operations) {
				if (operation !== fileName) {
					violations.push(`${relative(root, file)}: ${operation}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
