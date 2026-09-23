import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { importEditorSelectedResourceFilesFx } from "~/resource-authoring/fx/importEditorSelectedResourceFilesFx";
import { createTestPngBytes } from "~test/serapack-support/fn/createTestPngBytes";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "~test/project-authoring/filesystem/support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-editor-cli-import-");
});
afterEach(async () => harness.close());

describe("explicit Editor file import", () => {
	it("imports repeated artwork names with separate UIDs and paired titles", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const bytes = createTestPngBytes();
		const sourceA = join(harness.temporaryDirectory, "first", "little-gem.png");
		const sourceB = join(harness.temporaryDirectory, "second", "little-gem.png");
		await Promise.all([
			mkdir(join(harness.temporaryDirectory, "first")),
			mkdir(join(harness.temporaryDirectory, "second")),
		]);
		await Promise.all([
			writeFile(sourceA, bytes),
			writeFile(sourceB, bytes),
		]);
		const imported = await Effect.runPromise(
			importEditorSelectedResourceFilesFx({
				files: [
					{
						name: "little-gem.png",
						path: sourceA,
					},
					{
						name: "little-gem.png",
						path: sourceB,
					},
				],
				projectId: project.projectId,
				repository,
				type: "artwork",
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Missing project root.");
		expect(new Set(imported.resources.map(({ uid }) => uid)).size).toBe(2);
		for (const { uid, title } of imported.resources) {
			expect(title).toBe("Little Gem");
			expect(await readFile(join(root, "artwork", `${uid}.png`))).toEqual(Buffer.from(bytes));
			expect(
				JSON.parse(await readFile(join(root, "artwork", `${uid}.json`), "utf8")),
			).toEqual({
				title: "Little Gem",
			});
		}
	});

	it.each([
		"music",
		"sfx",
	] as const)("imports %s through the canonical audio path", async (type) => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const source = join(harness.temporaryDirectory, "final_battle.ogg");
		await writeFile(source, createTestOggOpusBytesFn());
		const imported = await Effect.runPromise(
			importEditorSelectedResourceFilesFx({
				files: [
					{
						name: "final_battle.ogg",
						path: source,
					},
				],
				projectId: project.projectId,
				repository,
				type,
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Missing project root.");
		const [resource] = imported.resources;
		expect(resource?.title).toBe("Final Battle");
		expect(
			JSON.parse(await readFile(join(root, type, `${resource?.uid}.json`), "utf8")),
		).toEqual({
			title: "Final Battle",
		});
		expect(
			(await readFile(join(root, type, `${resource?.uid}.ogg`))).byteLength,
		).toBeGreaterThan(0);
	});
});
