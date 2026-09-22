import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";

const electron = vi.hoisted(() => ({
	isPackaged: false,
	openPath: vi.fn(() => Promise.resolve("")),
}));

vi.mock("electron", () => ({
	app: {
		isPackaged: electron.isPackaged,
	},
	shell: {
		openPath: electron.openPath,
	},
}));

import { createDiagnosticLogFx } from "~electron/main/diagnostics/createDiagnosticLogFx";
import { writeFatalApplicationLogFx } from "~electron/main/diagnostics/writeFatalApplicationLogFx";
import { readGameDiagnosticLogSessionFx } from "~/game-incident/fx/readGameDiagnosticLogSessionFx";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, {
			force: true,
			recursive: true,
		});
	}
	electron.openPath.mockClear();
});

describe("Diagnostic log", () => {
	it("keeps human application history beside bounded gameplay JSONL", async () => {
		const userDataPath = mkdtempSync(join(tmpdir(), "serakki-diagnostics-"));
		temporaryDirectories.push(userDataPath);
		const diagnostics = Effect.runSync(
			createDiagnosticLogFx(join(userDataPath, "serakki", "diagnostics")),
		);

		await Effect.runPromise(diagnostics.openDirectoryFx);
		expect(electron.openPath).toHaveBeenCalledWith(diagnostics.directoryPath);
		Effect.runSync(
			diagnostics.writeFx({
				category: [
					"game",
					"session",
				],
				event: "session-started",
				level: "info",
				sessionId: "session:test",
				data: {
					applicationVersion: SerakkiAppVersion,
					provenance: "official",
					packageId: "serakki",
					contentHash: "a".repeat(64),
					gameVersion: "1.0.0",
					serakki: "0.5.1",
					restored: false,
					startedAt: "2026-09-22T18:00:00.000Z",
				},
			}),
		);

		const payload = "x".repeat(60_000);
		for (let index = 0; index < 90; index += 1) {
			Effect.runSync(
				diagnostics.writeFx({
					category: [
						"test",
						"rotation",
					],
					event: "large-record",
					level: "info",
					sessionId: "session:test",
					data: {
						index,
						payload,
					},
				}),
			);
			Effect.runSync(
				diagnostics.writeApplicationFx({
					level: "error",
					message: `Application failure ${index}`,
					body:
						index === 89
							? 'Project {"projectId":"private-player-project"} at /Users/player/private'
							: `Operation: test\n\n${payload}`,
				}),
			);
		}
		Effect.runSync(
			diagnostics.writeFx({
				category: [
					"game",
					"failure",
				],
				event: "runtime-failed",
				level: "error",
				sessionId: "session:test",
				data: {
					error: "private failure text",
					nested: {
						projectId: "private-player-project",
					},
				},
			}),
		);
		Effect.runSync(
			diagnostics.writeFx({
				category: [
					"game",
					"session",
				],
				event: "session-failed",
				level: "fatal",
				sessionId: "session:test",
				data: {
					source: "runtime",
					error: "private failure text",
					errorTruncated: false,
					sequence: 1,
					lastCommitted: null,
					lastCommittedTruncated: false,
					relatedItems: [],
					relatedItemsTruncated: false,
				},
			}),
		);
		Effect.runSync(
			diagnostics.writeFx({
				category: [
					"game",
					"session",
				],
				event: "session-started",
				level: "info",
				sessionId: "session:community",
				data: {
					provenance: "community",
					projectId: "private-player-project",
				},
			}),
		);
		Effect.runSync(
			diagnostics.writeFx({
				category: [
					"editor",
					"item-save",
				],
				event: "item-save-started",
				level: "info",
				data: {
					itemId: "private-player-item",
				},
			}),
		);
		const snapshot = await Effect.runPromise(diagnostics.snapshotFx);
		await expect(Effect.runPromise(diagnostics.readLastGameFx)).resolves.toEqual({
			provenance: "community",
		});
		expect(snapshot.map(({ name }) => name)).toEqual([
			"support.jsonl",
			"support.jsonl.1",
			"support.md",
		]);
		expect(snapshot.every(({ bytes }) => bytes.byteLength > 0)).toBe(true);
		Effect.runSync(diagnostics.closeFx);

		const filenames = readdirSync(diagnostics.directoryPath)
			.filter((filename) => filename.startsWith("support.jsonl"))
			.sort();
		expect(filenames).toEqual([
			"support.jsonl",
			"support.jsonl.1",
		]);
		for (const filename of filenames) {
			expect(statSync(join(diagnostics.directoryPath, filename)).size).toBeLessThan(
				5.1 * 1_024 * 1_024,
			);
		}
		const applicationFilenames = readdirSync(diagnostics.directoryPath)
			.filter((filename) => filename.startsWith("support.md"))
			.sort();
		expect(applicationFilenames).toEqual([
			"support.md",
		]);
		for (const filename of applicationFilenames) {
			expect(statSync(join(diagnostics.directoryPath, filename)).size).toBeLessThan(
				5.1 * 1_024 * 1_024,
			);
		}
		const applicationText = readFileSync(join(diagnostics.directoryPath, "support.md"), "utf8");
		expect(applicationText).toMatch(
			/^# \d{4}-\d{2}-\d{2}T[^\n]+ \[ERROR\] - Application failure \d+/u,
		);
		expect(applicationText).toContain(
			`\n\nSerakki v${SerakkiAppVersion} · development · ${process.platform} ${process.arch}\n\nDetails omitted from support log.\n\n`,
		);
		expect(applicationText).not.toContain('"logger"');
		expect(applicationText).not.toContain("item-save-started");
		expect(applicationText).not.toContain("private-player-project");
		expect(applicationText).not.toContain("/Users/player/private");
		const currentRecords = readFileSync(
			join(diagnostics.directoryPath, "support.jsonl"),
			"utf8",
		)
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(currentRecords.at(-1)).toMatchObject({
			level: "FATAL",
			logger: "serakki.game.session",
			message: "session-failed",
			properties: {
				error: "<redacted>",
				errorTruncated: false,
				event: "session-failed",
			},
		});
		expect(JSON.stringify(currentRecords)).toContain('"error":"<redacted>"');
		expect(JSON.stringify(currentRecords)).not.toContain("private failure text");
		expect(JSON.stringify(currentRecords)).not.toContain("session:community");
		expect(JSON.stringify(currentRecords)).not.toContain("private-player-item");
		await expect(
			Effect.runPromise(
				readGameDiagnosticLogSessionFx({
					input: diagnostics.directoryPath,
					requestedSessionId: "session:test",
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).resolves.toMatchObject({
			failure: {
				error: "<redacted>",
				errorTruncated: false,
			},
		});
		await Effect.runPromise(
			writeFatalApplicationLogFx({
				directoryPath: diagnostics.directoryPath,
				error: new Error("late main failure"),
			}),
		);
		const fatalText = readFileSync(join(diagnostics.directoryPath, "support.md"), "utf8");
		expect(fatalText).toContain("[FATAL] - Application lifecycle failed");
		expect(fatalText).toContain(
			`Serakki v${SerakkiAppVersion} · development · ${process.platform} ${process.arch}`,
		);
		expect(fatalText).toContain("Details omitted from support log.");
		expect(fatalText).not.toContain("late main failure");
	});
});
