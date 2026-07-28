import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
	openPath: vi.fn(() => Promise.resolve("")),
}));

vi.mock("electron", () => ({
	shell: {
		openPath: electron.openPath,
	},
}));

import { createDiagnosticLogFx } from "../../electron/main/diagnostics/createDiagnosticLogFx";

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
	it("writes parseable JSONL, opens its exact directory, and rotates before growing unbounded", async () => {
		const userDataPath = mkdtempSync(join(tmpdir(), "arkini-diagnostics-"));
		temporaryDirectories.push(userDataPath);
		const diagnostics = Effect.runSync(createDiagnosticLogFx(userDataPath));

		await Effect.runPromise(diagnostics.openDirectoryFx);
		expect(electron.openPath).toHaveBeenCalledWith(diagnostics.directoryPath);

		const payload = "x".repeat(60_000);
		for (let index = 0; index < 90; index += 1) {
			Effect.runSync(
				diagnostics.writeFx({
					schemaVersion: 1,
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
		}
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
		const currentRecords = readFileSync(
			join(diagnostics.directoryPath, "diagnostics.jsonl"),
			"utf8",
		)
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(currentRecords.at(-1)).toMatchObject({
			level: "INFO",
			logger: "arkini.test.rotation",
			message: "large-record",
			properties: {
				event: "large-record",
				index: 89,
				schemaVersion: 1,
				sessionId: "session:test",
			},
		});
	});
});
