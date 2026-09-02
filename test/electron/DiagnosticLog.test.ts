import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

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
		const userDataPath = mkdtempSync(join(tmpdir(), "arkini-diagnostics-"));
		temporaryDirectories.push(userDataPath);
		const diagnostics = Effect.runSync(
			createDiagnosticLogFx(join(userDataPath, "arkini", "diagnostics")),
		);

		await Effect.runPromise(diagnostics.openDirectoryFx);
		expect(electron.openPath).toHaveBeenCalledWith(diagnostics.directoryPath);

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
					body: `Operation: test\n\n${payload}`,
				}),
			);
		}
		Effect.runSync(
			diagnostics.writeFx({
				category: [
					"application",
				],
				event: "gameplay-application-event",
				level: "info",
				data: {},
			}),
		);
		Effect.runSync(diagnostics.closeFx);

		const filenames = readdirSync(diagnostics.directoryPath)
			.filter((filename) => filename.startsWith("diagnostics.jsonl"))
			.sort();
		expect(filenames).toEqual([
			"diagnostics.jsonl",
			"diagnostics.jsonl.1",
		]);
		for (const filename of filenames) {
			expect(statSync(join(diagnostics.directoryPath, filename)).size).toBeLessThan(
				5.1 * 1_024 * 1_024,
			);
		}
		const applicationFilenames = readdirSync(diagnostics.directoryPath)
			.filter((filename) => filename.startsWith("application.md"))
			.sort();
		expect(applicationFilenames).toEqual([
			"application.md",
			"application.md.1",
		]);
		for (const filename of applicationFilenames) {
			expect(statSync(join(diagnostics.directoryPath, filename)).size).toBeLessThan(
				5.1 * 1_024 * 1_024,
			);
		}
		const applicationText = readFileSync(
			join(diagnostics.directoryPath, "application.md"),
			"utf8",
		);
		expect(applicationText).toMatch(
			/^# \d{4}-\d{2}-\d{2}T[^\n]+ \[ERROR\] - Application failure \d+/u,
		);
		expect(applicationText).toContain(
			`\n\nArkini v${ArkiniAppVersion} · development · ${process.platform} ${process.arch}\n\nOperation: test\n\n`,
		);
		expect(applicationText).not.toContain('"logger"');
		expect(applicationText).not.toContain("gameplay-application-event");
		const currentRecords = readFileSync(
			join(diagnostics.directoryPath, "diagnostics.jsonl"),
			"utf8",
		)
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(currentRecords.at(-1)).toMatchObject({
			level: "INFO",
			logger: "arkini.application",
			message: "gameplay-application-event",
			properties: {
				event: "gameplay-application-event",
			},
		});
		await Effect.runPromise(
			writeFatalApplicationLogFx({
				directoryPath: diagnostics.directoryPath,
				error: new Error("late main failure"),
			}),
		);
		const fatalText = readFileSync(join(diagnostics.directoryPath, "application.md"), "utf8");
		expect(fatalText).toContain("[FATAL] - Application lifecycle failed");
		expect(fatalText).toContain(
			`Arkini v${ArkiniAppVersion} · development · ${process.platform} ${process.arch}`,
		);
		expect(fatalText).toContain("name: Error\nmessage: late main failure");
	});
});
