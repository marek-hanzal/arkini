import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
	it("hard-overwrites the fixed Arkpack, save, and themed diagnostic environment", async () => {
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
						text: {
							incident: `# Incident ${marker}`,
							failure: `# Failure ${marker}`,
							history: `# History ${marker}`,
							runtimeState: `# Runtime ${marker}`,
						},
					},
				}),
			);
			if (marker === 1) {
				await writeFile(
					join(root, GameIncidentFiles.directory, "diagnostics.jsonl"),
					"obsolete",
				);
			}
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
		expect(await readFile(join(directory, GameIncidentFiles.incident), "utf8")).toBe(
			"# Incident 2",
		);
		expect(await readFile(join(directory, GameIncidentFiles.failure), "utf8")).toBe(
			"# Failure 2",
		);
		expect(await readFile(join(directory, GameIncidentFiles.history), "utf8")).toBe(
			"# History 2",
		);
		expect(await readFile(join(directory, GameIncidentFiles.runtimeState), "utf8")).toBe(
			"# Runtime 2",
		);
		await expect(readFile(join(directory, "diagnostics.jsonl"), "utf8")).rejects.toThrow();
	});
});
