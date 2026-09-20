import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Effect } from "effect";

import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { writeLatestGameIncidentFx } from "~electron/main/incident/writeLatestGameIncidentFx";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import { createTestSerapack } from "~test/serapack-support/fx/createTestSerapack";

let root = "";

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "serakki-incident-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("latest game incident files", () => {
	it("hard-overwrites the fixed Serapack, save, and themed diagnostic environment", async () => {
		const bundledSerapacksRoot = join(root, "bundled");
		const userSerapacksRoot = join(root, "user");
		const packageId = "game:test";
		const serapackPath = join(userSerapacksRoot, readSerapackArtifactNameFn(packageId));
		await mkdir(userSerapacksRoot, {
			recursive: true,
		});
		let latestSerapack = new Uint8Array();
		for (const marker of [
			1,
			2,
		]) {
			latestSerapack = createTestSerapack(undefined, packageId, marker === 1 ? "1.0" : "1.1");
			await writeFile(serapackPath, latestSerapack);
			const layout = await Effect.runPromise(readSerapackFileLayoutFx(serapackPath));
			await Effect.runPromise(
				writeLatestGameIncidentFx({
					bundledSerapacksRoot,
					incidentsRoot: root,
					incident: {
						serapack: {
							packageId,
							contentHash: layout.contentHash,
							source: "user",
						},
						saveBytes: Uint8Array.of(marker + 10),
						text: {
							incident: `# Incident ${marker}`,
							failure: `# Failure ${marker}`,
							history: `# History ${marker}`,
							runtimeState: `# Runtime ${marker}`,
						},
					},
					userSerapacksRoot,
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
		expect(await readFile(join(directory, GameIncidentFiles.serapack))).toEqual(
			Buffer.from(latestSerapack),
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
