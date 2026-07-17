import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tsxCli = resolve("node_modules/tsx/dist/cli.mjs");
const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");
const runCli = (...args: ReadonlyArray<string>) =>
	spawnSync(
		process.execPath,
		[
			tsxCli,
			"cli/arkini.ts",
			...args,
		],
		{
			cwd: resolve("."),
			encoding: "utf8",
		},
	);

describe("Arkini Effect CLI", () => {
	it("exposes one discoverable game and desktop command tree", () => {
		const result = runCli("--help");
		const output = stripAnsi(`${result.stdout}${result.stderr}`);

		expect(result.status).toBe(0);
		expect(output).toContain("game validate");
		expect(output).toContain("game schema");
		expect(output).toContain("desktop build");
		expect(output).toContain("desktop clean");
		expect(output).toContain("desktop stage");
		expect(output).toContain("desktop package [--arch arm64]");
		expect(output).toContain("desktop preview-macos");
		expect(output).toContain("desktop checksums");
		expect(output).toContain("desktop verify");
		expect(output).not.toContain("desktop desktop");
	});

	it("rejects unsupported package architecture with a deterministic non-zero exit", () => {
		const result = runCli("desktop", "package", "--arch", "x64");
		const output = stripAnsi(`${result.stdout}${result.stderr}`);

		expect(result.status).not.toBe(0);
		expect(output).toContain("arm64");
	});
});
