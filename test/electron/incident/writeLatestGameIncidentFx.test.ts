import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Effect } from "effect";

import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { writeLatestGameIncidentFx } from "~electron/main/incident/writeLatestGameIncidentFx";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-incident-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("latest game incident files", () => {
	it("hard-overwrites the fixed Arkpack, save, and diagnostic environment", async () => {
		for (const marker of [
			1,
			2,
		]) {
			await Effect.runPromise(
				writeLatestGameIncidentFx({
					incidentsRoot: root,
					incident: {
						arkpackBytes: Uint8Array.of(marker),
						saveBytes: Uint8Array.of(marker + 10),
						diagnostics: [
							{
								level: "info",
								category: [
									"game",
								],
								event: "session-started",
								sessionId: `session:${marker}`,
							},
							{
								level: "fatal",
								category: [
									"game",
								],
								event: "session-failed",
								sessionId: `session:${marker}`,
							},
						],
					},
				}),
			);
		}

		const directory = join(root, GameIncidentFiles.directory);
		expect(await readFile(join(directory, GameIncidentFiles.arkpack))).toEqual(
			Buffer.from([
				2,
			]),
		);
		expect(await readFile(join(directory, GameIncidentFiles.save))).toEqual(
			Buffer.from([
				12,
			]),
		);
		const diagnostics = (await readFile(join(directory, GameIncidentFiles.diagnostics), "utf8"))
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(diagnostics).toHaveLength(2);
		expect(diagnostics.map(({ sessionId }) => sessionId)).toEqual([
			"session:2",
			"session:2",
		]);
	});
});
