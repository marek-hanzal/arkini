import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("completed game compiler boundary", () => {
	it("keeps pack and test config loading on the production compiler", () => {
		expect(read("src/v1/pack/fx/packDirectoryFx.ts")).toContain(
			'from "~/v1/compiler/fx/compileGameSourcesFx"',
		);
		expect(read("test/schema/support/readArkiniGameConfigSource.ts")).toContain(
			'from "~/v1/compiler/fx/compileGameDirectoryFx"',
		);
	});

	it("keeps completed config validation outside CLI adapters", () => {
		const validateCommand = read("src/v1/validation/cli/ValidateCommand.ts");

		expect(validateCommand).toContain("compileGameDirectoryFx");
		expect(validateCommand).toContain("assertGameConfigValidFx");
		expect(validateCommand).not.toContain("GameConfigSchema");
		expect(validateCommand).not.toContain("validateGameConfigFx");
	});
});
