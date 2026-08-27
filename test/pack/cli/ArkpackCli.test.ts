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

describe("Arkpack trust CLI", () => {
	it("offline-classifies a local artifact without a bundle as External", async () => {
		const arkpackPath = join(root, "fixture.arkpack");
		await writeFile(arkpackPath, "local bytes");

		const result = await execFileAsync(
			process.execPath,
			[
				"node_modules/tsx/dist/cli.mjs",
				"src/engine/cli/arkini.ts",
				"arkpack",
				"verify",
				arkpackPath,
			],
			{
				env: process.env,
			},
		);

		expect(JSON.parse(result.stdout.trim())).toEqual({
			type: "external",
		});
	}, 15_000);
});
