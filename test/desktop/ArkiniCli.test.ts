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
		const root = runCli("--help");
		const rootOutput = stripAnsi(`${root.stdout}${root.stderr}`);
		expect(root.status).toBe(0);
		expect(rootOutput).toContain("arkpack");
		expect(rootOutput).toContain("game");
		expect(rootOutput).toContain("desktop");

		const game = runCli("game", "--help");
		const gameOutput = stripAnsi(`${game.stdout}${game.stderr}`);
		expect(game.status).toBe(0);
		expect(gameOutput).toContain("pack");
		expect(gameOutput).toContain("pack-demo");
		expect(gameOutput).toContain("schema");
		expect(gameOutput).toContain("validate");

		const desktop = runCli("desktop", "--help");
		const desktopOutput = stripAnsi(`${desktop.stdout}${desktop.stderr}`);
		expect(desktop.status).toBe(0);
		expect(desktopOutput).toContain("build");
		expect(desktopOutput).toContain("clean");
		expect(desktopOutput).toContain("stage");
		expect(desktopOutput).toContain("package");
		expect(desktopOutput).toContain("preview-macos");
		expect(desktopOutput).toContain("checksums");
		expect(desktopOutput).toContain("verify");
		expect(desktopOutput).not.toContain("desktop desktop");

		const desktopPackage = runCli("desktop", "package", "--help");
		const desktopPackageOutput = stripAnsi(`${desktopPackage.stdout}${desktopPackage.stderr}`);
		expect(desktopPackage.status).toBe(0);
		expect(desktopPackageOutput).toContain("--arch");
		expect(desktopPackageOutput).toContain("choices: arm64");
	});

	it("rejects unsupported package architecture with a deterministic non-zero exit", () => {
		const result = runCli("desktop", "package", "--arch", "x64");
		const output = stripAnsi(`${result.stdout}${result.stderr}`);

		expect(result.status).not.toBe(0);
		expect(output).toContain("arm64");
	});
});
