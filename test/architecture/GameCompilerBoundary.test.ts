import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const collectTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = join(directory, entry.name);

		return entry.isDirectory()
			? collectTypeScriptFiles(path)
			: entry.isFile() && path.endsWith(".ts")
				? [
						path,
					]
				: [];
	});

describe("completed game compiler boundary", () => {
	it("keeps pack and test config loading on the production compiler", () => {
		expect(read("src/v1/pack/fx/packDirectoryFx.ts")).toContain(
			'from "~/v1/compiler/fx/compileGameSourcesFx"',
		);
		expect(read("test/schema/support/readArkiniGameConfigSource.ts")).toContain(
			'from "~/v1/compiler/fx/compileGameDirectoryFx"',
		);
	});

	it("keeps the canonical compiler independent from binary packing", () => {
		const invalidImports = collectTypeScriptFiles("src/v1/compiler").filter((path) =>
			read(path).includes('from "~/v1/pack/'),
		);

		expect(invalidImports).toEqual([]);
	});

	it("keeps completed config validation outside CLI adapters", () => {
		const validateCommand = read("src/v1/validation/cli/ValidateCommand.ts");

		expect(validateCommand).toContain("compileGameDirectoryFx");
		expect(validateCommand).toContain("assertGameConfigValidFx");
		expect(validateCommand).not.toContain("GameConfigSchema");
		expect(validateCommand).not.toContain("validateGameConfigFx");
	});
});
