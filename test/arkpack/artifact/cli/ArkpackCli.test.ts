import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-signing-cli-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("Arkpack provenance CLI", () => {
	it("offline-classifies a local artifact without a proof as Community", async () => {
		const arkpackPath = join(root, "fixture.arkpack");
		await writeFile(arkpackPath, "local bytes");

		const result = await execFileAsync(
			process.execPath,
			[
				"node_modules/tsx/dist/cli.mjs",
				"src/arkini-cli/arkini.ts",
				"arkpack",
				"verify",
				arkpackPath,
			],
			{
				env: process.env,
			},
		);

		expect(JSON.parse(result.stdout.trim())).toEqual({
			type: "community",
		});
	}, 15_000);
});

describe("CLI completion", () => {
	it("generates static Bash, Fish, and Zsh completion from the public command tree", async () => {
		for (const shell of [
			"bash",
			"fish",
			"zsh",
		] as const) {
			const result = await execFileAsync(
				process.execPath,
				[
					"node_modules/tsx/dist/cli.mjs",
					"src/arkini-cli/arkini.ts",
					"--completions",
					shell,
				],
				{
					env: process.env,
				},
			);

			expect(result.stdout).toContain("arkini-cli");
			expect(result.stdout).toContain("game");
			expect(result.stdout).toContain("arkpack");
		}
	}, 15_000);
});
