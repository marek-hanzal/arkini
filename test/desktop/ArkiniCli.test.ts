import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ArkiniAppVersion } from "../../shared/ArkiniAppMetadata";

const tsxCli = resolve("node_modules/tsx/dist/cli.mjs");
const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");
const runCli = (...args: ReadonlyArray<string>) =>
	spawnSync(
		process.execPath,
		[
			tsxCli,
			"cli/arkini-repository.ts",
			...args,
		],
		{
			cwd: resolve("."),
			encoding: "utf8",
		},
	);
const runDistributionCli = (...args: ReadonlyArray<string>) =>
	spawnSync(
		process.execPath,
		[
			tsxCli,
			"src/engine/cli/arkini.ts",
			...args,
		],
		{
			cwd: resolve("."),
			encoding: "utf8",
		},
	);

describe("Arkini Effect CLI", () => {
	it("reports the canonical package version", () => {
		const result = runCli("--version");
		const output = stripAnsi(`${result.stdout}${result.stderr}`);

		expect(result.status).toBe(0);
		expect(output).toContain(ArkiniAppVersion);
	});

	it("keeps desktop orchestration out of the distributed command tree", () => {
		const result = runDistributionCli("--help");
		const output = stripAnsi(`${result.stdout}${result.stderr}`);

		expect(result.status).toBe(0);
		expect(output).toContain("arkpack");
		expect(output).toContain("game");
		expect(output).not.toContain("desktop");
	});

	it("keeps repository orchestration limited to desktop delivery", () => {
		const root = runCli("--help");
		const rootOutput = stripAnsi(`${root.stdout}${root.stderr}`);
		expect(root.status).toBe(0);
		expect(rootOutput).toContain("desktop");
		expect(rootOutput).not.toContain("arkpack");
		expect(rootOutput).not.toContain("game");

		const desktop = runCli("desktop", "--help");
		const desktopOutput = stripAnsi(`${desktop.stdout}${desktop.stderr}`);
		expect(desktop.status).toBe(0);
		expect(desktopOutput).toContain("build");
		expect(desktopOutput).toContain("package");
		expect(desktopOutput).toContain("preview-macos");
		expect(desktopOutput).toContain("verify");
		expect(desktopOutput).not.toContain("desktop desktop");

		const desktopPackage = runCli("desktop", "package", "--help");
		const desktopPackageOutput = stripAnsi(`${desktopPackage.stdout}${desktopPackage.stderr}`);
		expect(desktopPackage.status).toBe(0);
		expect(desktopPackageOutput).toContain("--arch");
		expect(desktopPackageOutput).toContain("choices: arm64");
	}, 30_000);

	it("exposes product game commands without the removed demo", () => {
		const game = runDistributionCli("game", "--help");
		const output = stripAnsi(`${game.stdout}${game.stderr}`);
		expect(game.status).toBe(0);
		expect(output).toContain("pack");
		expect(output).toContain("schema");
		expect(output).toContain("validate");
		expect(output).not.toContain("pack-demo");
	});

	it("rejects unsupported package architecture with a deterministic non-zero exit", () => {
		const result = runCli("desktop", "package", "--arch", "x64");
		const output = stripAnsi(`${result.stdout}${result.stderr}`);

		expect(result.status).not.toBe(0);
		expect(output).toContain("arm64");
	});
});
