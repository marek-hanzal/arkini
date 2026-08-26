import { access, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
	EditorProjectFormat,
	EditorProjectFormatVersion,
} from "~/editor/filesystem/EditorProjectFileSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createFilesystemEditorProjectFilesHarness } from "./FilesystemEditorProjectFiles.test/harness";

const openHarnesses: Array<Awaited<ReturnType<typeof createFilesystemEditorProjectFilesHarness>>> =
	[];

afterEach(async () => {
	await Promise.all(openHarnesses.splice(0).map((harness) => harness.close()));
});

describe("filesystem Editor project current tree", () => {
	it("round-trips and republishes the complete authoritative current tree", async () => {
		const harness = await createFilesystemEditorProjectFilesHarness();
		openHarnesses.push(harness);
		const initial = {
			marker: {
				format: EditorProjectFormat,
				formatVersion: EditorProjectFormatVersion,
				arkpackVersion: editorTestPayload.version,
				updatedAtMs: 1,
			},
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		} as const;

		await harness.write(initial);
		expect(await harness.read()).toEqual(initial);
		expect(
			JSON.parse(await readFile(join(harness.root, "game.json"), "utf8")),
		).not.toHaveProperty("items");
		const waterPath = join(harness.root, "items", "simple", "water.json");
		const waterResourcePath = join(harness.root, "assets", "item-water.png");
		await writeFile(waterPath, '{"items":{}}');
		await rm(waterResourcePath);
		const repaired = {
			...initial,
			marker: {
				...initial.marker,
				updatedAtMs: 2,
			},
		};
		await harness.write(repaired, initial);
		expect(await harness.read()).toEqual(repaired);

		const next = {
			marker: {
				...repaired.marker,
				updatedAtMs: 3,
			},
			config: GameConfigSchema.parse({
				...repaired.config,
				items: {
					water: {
						...initial.config.items.water,
						uid: "water.next",
						title: "Fresh water",
					},
				},
			}),
			resources: repaired.resources.map((resource) =>
				resource.id === "item-water"
					? {
							...resource,
							bytes: new Uint8Array([
								8,
								9,
							]),
						}
					: resource,
			),
		};

		await harness.write(next, repaired);
		await expect(
			access(join(harness.root, "items", "simple", "water.json")),
		).rejects.toBeDefined();
		expect(
			JSON.parse(
				await readFile(join(harness.root, "items", "simple", "water%2Enext.json"), "utf8"),
			),
		).toEqual({
			items: {
				water: next.config.items.water,
			},
		});
		expect(await harness.read()).toEqual(next);
	});

	it("rejects a mutable project directory symlink instead of writing through it", async () => {
		const harness = await createFilesystemEditorProjectFilesHarness();
		openHarnesses.push(harness);
		const outside = join(harness.root, "..", "outside-items");
		await Promise.all([
			mkdir(harness.root),
			mkdir(outside),
		]);
		await rm(join(harness.root, "items"), {
			force: true,
			recursive: true,
		});
		await symlink(outside, join(harness.root, "items"));

		await expect(
			harness.write({
				marker: {
					format: EditorProjectFormat,
					formatVersion: EditorProjectFormatVersion,
					arkpackVersion: editorTestPayload.version,
					updatedAtMs: 1,
				},
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		).rejects.toThrow("must not be a symbolic link");
		await expect(access(join(outside, "simple", "water.json"))).rejects.toBeDefined();
	});
});
