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

const diagnosticHistoryEntry = {
	sequence: 7,
	observedAt: "2026-09-01T11:00:01.000Z",
	elapsedSincePreviousMs: 1_000,
	initial: false,
	events: [
		{
			type: "job:started",
			details: {
				jobId: "job:test",
			},
			relatedItems: [],
		},
	],
	itemCount: 1,
	jobCount: 1,
	queueCount: 0,
	jobsAdded: [],
	jobsRemoved: [],
	queueAdded: [],
	queueRemoved: [],
	defaultLinesChanged: [],
	deliveries: [],
	truncated: false,
};

const diagnosticLogLine = ({
	event,
	level,
	properties,
	timestamp,
}: {
	readonly event: string;
	readonly level: "INFO" | "FATAL";
	readonly properties: Readonly<Record<string, unknown>>;
	readonly timestamp: string;
}) =>
	JSON.stringify({
		"@timestamp": timestamp,
		level,
		message: event,
		logger: "arkini.game",
		properties: {
			event,
			...properties,
		},
	});

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

		expect(result.stdout).toContain("# Arkini game replay");
		expect(result.stdout).toContain("No fatal failure was observed");
		expect(result.stdout).toContain("- Package: game:test");
		expect(result.stdout).toContain("# Semantic history");
		expect(result.stdout.trimStart()).not.toMatch(/^\{/);
	}, 15_000);

	it("reports invalid replay requests without framework stacks or physical paths", async () => {
		const missingIncident = join(root, "missing-incident");
		const runRejectedReplayFn = async (args: readonly string[]) =>
			execFileAsync(
				process.execPath,
				[
					"node_modules/tsx/dist/cli.mjs",
					"src/arkini-cli/arkini.ts",
					"game",
					"replay",
					...args,
				],
				{
					env: process.env,
				},
			).catch(
				(cause: unknown) =>
					cause as {
						readonly stderr: string;
						readonly stdout: string;
					},
			);
		const invalidTimeout = await runRejectedReplayFn([
			"--incident",
			missingIncident,
			"--until-fatal",
			"--timeout-ms",
			"0",
		]);
		const missingInput = await runRejectedReplayFn([
			"--incident",
			missingIncident,
			"--until-fatal",
			"--timeout-ms",
			"10",
		]);
		const invalidTimeoutOutput = `${invalidTimeout.stdout}${invalidTimeout.stderr}`;
		const missingInputOutput = `${missingInput.stdout}${missingInput.stderr}`;

		expect(invalidTimeoutOutput).toContain("--timeout-ms must be between 1 and 300000");
		expect(missingInputOutput).toContain("Could not read the replay Arkpack");
		for (const output of [
			invalidTimeoutOutput,
			missingInputOutput,
		]) {
			expect(output).not.toContain(root);
			expect(output).not.toContain("app.asar");
			expect(output).not.toContain("file:///");
			expect(output).not.toMatch(/\n\s+at\s/u);
		}
	}, 15_000);

	it("selects one thematic section from a fixed text incident", async () => {
		const incident = join(root, GameIncidentFiles.directory);
		await mkdir(incident);
		await writeFile(join(incident, GameIncidentFiles.incident), "# Incident summary");
		await writeFile(join(incident, GameIncidentFiles.failure), "# Exact failure");
		await writeFile(join(incident, GameIncidentFiles.history), "# Exact history");
		await writeFile(join(incident, GameIncidentFiles.runtimeState), "# Exact runtime");

		const result = await execFileAsync(
			process.execPath,
			[
				"node_modules/tsx/dist/cli.mjs",
				"src/arkini-cli/arkini.ts",
				"diagnostics",
				"slice",
				incident,
				"--section",
				"failure",
			],
			{
				env: process.env,
			},
		);

		expect(result.stdout.trim()).toBe("# Exact failure");

		const runtime = await execFileAsync(
			process.execPath,
			[
				"node_modules/tsx/dist/cli.mjs",
				"src/arkini-cli/arkini.ts",
				"diagnostics",
				"slice",
				incident,
				"--section",
				"runtime",
			],
			{
				env: process.env,
			},
		);
		expect(runtime.stdout.trim()).toBe("# Exact runtime");

		const rejectedSession = await execFileAsync(
			process.execPath,
			[
				"node_modules/tsx/dist/cli.mjs",
				"src/arkini-cli/arkini.ts",
				"diagnostics",
				"slice",
				incident,
				"--session-id",
				"session:wrong",
			],
			{
				env: process.env,
			},
		).catch(
			(cause: unknown) =>
				cause as {
					readonly stderr: string;
					readonly stdout: string;
				},
		);
		const rejectionOutput = `${rejectedSession.stdout}${rejectedSession.stderr}`;
		expect(rejectionOutput).toContain("--session-id applies only to diagnostic JSONL");
		expect(rejectionOutput).not.toContain(root);
		expect(rejectionOutput).not.toContain("DiagnosticsSliceCommand.ts");
		expect(rejectionOutput).not.toMatch(/\n\s+at\s/u);
	}, 15_000);

	it("renders the latest failed session from the current rotating JSONL contract", async () => {
		const logs = join(root, "logs");
		await mkdir(logs);
		const rotated = join(logs, "diagnostics.jsonl.1");
		const current = join(logs, "diagnostics.jsonl");
		await writeFile(
			rotated,
			`${diagnosticLogLine({
				event: "session-started",
				level: "INFO",
				properties: {
					sessionId: "session:old",
				},
				timestamp: "2026-09-01T10:00:00.000Z",
			})}\n${diagnosticLogLine({
				event: "session-failed",
				level: "FATAL",
				properties: {
					sessionId: "session:old",
				},
				timestamp: "2026-09-01T10:00:01.000Z",
			})}\n`,
		);
		await writeFile(
			current,
			`not-json\n${diagnosticLogLine({
				event: "session-started",
				level: "INFO",
				properties: {
					sessionId: "session:new",
					applicationVersion: "0.5.0",
					packageId: "game:test",
					contentHash: "hash:test",
					gameVersion: "1.0",
					arkini: "0.5.0",
					restored: true,
					startedAt: "2026-09-01T11:00:00.000Z",
				},
				timestamp: "2026-09-01T11:00:00.000Z",
			})}\n${diagnosticLogLine({
				event: "runtime-committed",
				level: "INFO",
				properties: {
					sessionId: "session:new",
					sequence: 7,
					eventTypes: [
						"job:started",
					],
					history: diagnosticHistoryEntry,
					historyTruncated: true,
				},
				timestamp: "2026-09-01T11:00:01.000Z",
			})}\n${diagnosticLogLine({
				event: "session-failed",
				level: "FATAL",
				properties: {
					sessionId: "session:new",
					source: "tick",
					sequence: 42,
					error: {
						name: "JobOwnerBusyError",
					},
					errorTruncated: false,
					lastCommitted: null,
					lastCommittedTruncated: false,
					relatedItems: [],
					relatedItemsTruncated: false,
				},
				timestamp: "2026-09-01T11:00:02.000Z",
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

		expect(result.stdout).toContain("# Game diagnostic session");
		expect(result.stdout).toContain("- Session: session:new");
		expect(result.stdout).toContain("- Package: game:test");
		expect(result.stdout).toContain("- Failure: tick at sequence 42");
		expect(result.stdout).toContain("- Input warnings: 1");
		expect(result.stdout).toContain("invalid JSON");
		expect(result.stdout).toContain("1 retained record contains truncated");
		expect(result.stdout).toContain("name: JobOwnerBusyError");
		expect(result.stdout).not.toContain(root);
		expect(result.stdout.trimStart()).not.toMatch(/^\{/);
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
