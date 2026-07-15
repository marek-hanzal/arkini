import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readTypeScriptFiles = (directory: string): string[] => {
	return readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readTypeScriptFiles(path);
		return entry.isFile() && entry.name.endsWith(".ts")
			? [
					path,
				]
			: [];
	});
};

describe("v1 named operation grammar", () => {
	it("keeps exported domain operations as one same-named Fx per file", () => {
		const root = resolve("src/v1");
		const violations: string[] = [];

		for (const file of readTypeScriptFiles(root)) {
			const projectPath = relative(root, file).replaceAll("\\", "/");
			if (projectPath.startsWith("ui/")) continue;
			if (/^runtime\/read\/is[A-Z].*RuntimeItem\.ts$/.test(projectPath)) continue;

			const fileName = basename(file, ".ts");
			const source = readFileSync(file, "utf8");
			const exportedOperations = [
				...source.matchAll(/export\s+(?:const|function)\s+([a-z][A-Za-z0-9_]*)\b/g),
			].map((match) => match[1]);
			for (const operation of exportedOperations) {
				if (operation !== fileName || !operation.endsWith("Fx")) {
					violations.push(`${projectPath}: ${operation}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
