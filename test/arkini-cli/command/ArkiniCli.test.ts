import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";

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

describe("game incident CLI", () => {
	it("replays a fixed incident environment through the production GameSession", async () => {
		const incident = join(root, GameIncidentFiles.directory);
		await mkdir(incident);
		await writeFile(join(incident, GameIncidentFiles.arkpack), createTestArkpack());
		await writeFile(
			join(incident, GameIncidentFiles.save),
			encodeArkiniSaveFn({
				version: "1.0",
				state: StateSchema.parse({
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						{
							id: "runtime:item:water",
							itemId: "water",
							location: {
								scope: "board",
								space: 0,
								position: {
									x: 1,
									y: 0,
								},
							},
							quantity: 1,
						},
					],
					jobs: [],
					jobQueue: [],
				}),
			}),
		);

		const result = await execFileAsync(
			process.execPath,
			[
				"node_modules/tsx/dist/cli.mjs",
				"src/arkini-cli/arkini.ts",
				"game",
				"replay",
				"--incident",
				incident,
				"--until-fatal",
				"--timeout-ms",
				"20",
			],
			{
				env: process.env,
			},
		);

		expect(JSON.parse(result.stdout.trim())).toMatchObject({
			status: "timeout",
			packageId: "game:test",
		});
	}, 15_000);

	it("slices the latest failed session across rotated and incident JSONL shapes", async () => {
		const logs = join(root, "logs");
		await mkdir(logs);
		const rotated = join(logs, "diagnostics.jsonl.1");
		const current = join(logs, "diagnostics.jsonl");
		await writeFile(
			rotated,
			`${JSON.stringify({
				level: "INFO",
				message: "session-started",
				properties: {
					event: "session-started",
					sessionId: "session:old",
				},
			})}\n${JSON.stringify({
				level: "FATAL",
				message: "session-failed",
				properties: {
					event: "session-failed",
					sessionId: "session:old",
				},
			})}\n`,
		);
		await writeFile(
			current,
			`${JSON.stringify({
				level: "info",
				category: [
					"game",
				],
				event: "session-started",
				sessionId: "session:new",
			})}\n${JSON.stringify({
				level: "fatal",
				category: [
					"game",
				],
				event: "session-failed",
				sessionId: "session:new",
			})}\n`,
		);
		await utimes(rotated, new Date(1_000), new Date(1_000));
		await utimes(current, new Date(2_000), new Date(2_000));

		const result = await execFileAsync(
			process.execPath,
			[
				"node_modules/tsx/dist/cli.mjs",
				"src/arkini-cli/arkini.ts",
				"diagnostics",
				"slice",
				logs,
			],
			{
				env: process.env,
			},
		);

		const records = result.stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(records).toHaveLength(2);
		expect(records.map(({ sessionId }) => sessionId)).toEqual([
			"session:new",
			"session:new",
		]);
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
