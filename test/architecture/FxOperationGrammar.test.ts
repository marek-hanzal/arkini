import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const activeRoots = [
	resolve("src/engine"),
	resolve("src/bridge"),
	resolve("src/ui"),
	resolve("src/page"),
	resolve("src/@routes"),
	resolve("electron"),
	resolve("cli"),
] as const;

const readTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return readTypeScriptFiles(path);
		return entry.isFile() && /\.tsx?$/.test(entry.name)
			? [
					path,
				]
			: [];
	});

const isExplicitPlainExport = (projectPath: string, exportName: string) =>
	exportName.startsWith("use") ||
	/^src\/engine\/runtime\/read\/is[A-Z].*RuntimeItem\.ts$/.test(projectPath);

describe("active named operation grammar", () => {
	it("keeps every exported project operation as a same-named Effect program ending in Fx", () => {
		const violations: string[] = [];

		for (const root of activeRoots) {
			for (const file of readTypeScriptFiles(root)) {
				const projectPath = relative(resolve("."), file).replaceAll("\\", "/");
				const fileName = basename(file).replace(/\.tsx?$/, "");
				const source = readFileSync(file, "utf8");
				const exportedOperations = [
					...source.matchAll(/export\s+(?:const|function)\s+([a-z][A-Za-z0-9_]*)\b/g),
				].map((match) => match[1]);

				for (const operation of exportedOperations) {
					if (isExplicitPlainExport(projectPath, operation)) continue;
					if (operation !== fileName || !operation.endsWith("Fx")) {
						violations.push(
							`${projectPath}: ${operation} must be ${fileName} and end in Fx`,
						);
						continue;
					}
					const requiresNamedEffectFn =
						projectPath.startsWith("electron/") ||
						projectPath.startsWith("src/bridge/") ||
						projectPath.startsWith("src/ui/") ||
						projectPath.startsWith("src/page/") ||
						projectPath.startsWith("src/@routes/") ||
						projectPath.startsWith("cli/");
					if (requiresNamedEffectFn && !source.includes(`Effect.fn("${operation}")`)) {
						violations.push(
							`${projectPath}: ${operation} must be a same-named Effect.fn program`,
						);
					} else if (!/\bEffect\b/.test(source)) {
						violations.push(
							`${projectPath}: ${operation} is not implemented as an Effect program`,
						);
					}
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
