import { access, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import {
	GameProjectGameSchemaReference,
	GameProjectItemSchemaReference,
} from "~/engine/source/GameProjectReference";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createProjectFilesHarness } from "./ProjectFiles.test/harness";

const openHarnesses: Array<Awaited<ReturnType<typeof createProjectFilesHarness>>> = [];

afterEach(async () => {
	await Promise.all(openHarnesses.splice(0).map((harness) => harness.close()));
});

describe("filesystem Editor project current tree", () => {
	it("round-trips and republishes the complete authoritative current tree", async () => {
		const harness = await createProjectFilesHarness();
		openHarnesses.push(harness);
		const initial = {
			arkpack: editorTestPayload.version,
			marker: {
				arkini: ArkiniAppVersion,
				revision: 1,
			},
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		} as const;

		await harness.write(initial);
		const canonicalInitial = {
			...initial,
			config: GameConfigSchema.parse({
				...initial.config,
				$schema: GameProjectGameSchemaReference,
			}),
		};
		expect(await harness.read()).toEqual(canonicalInitial);
		expect(JSON.parse(await readFile(join(harness.root, "project.json"), "utf8"))).toEqual({
			arkini: ArkiniAppVersion,
			revision: initial.marker.revision,
		});
		const schema = JSON.parse(await readFile(join(harness.root, "schema.json"), "utf8"));
		expect(schema).toMatchObject({
			anyOf: [
				{
					$ref: "urn:arkini:schema:project#/$defs/GameFileSchema",
				},
				{
					$ref: "urn:arkini:schema:project#/$defs/ItemFileSchema",
				},
			],
			$defs: {
				GameFileSchema: {
					properties: {
						version: {
							$ref: "urn:arkini:schema:project#/$defs/ArkpackVersionSchema",
						},
					},
					type: "object",
				},
				ItemFileSchema: {
					properties: {
						item: {
							$ref: "urn:arkini:schema:project#/$defs/ItemSchema",
						},
					},
					type: "object",
				},
			},
		});
		const game = JSON.parse(await readFile(join(harness.root, "game.json"), "utf8"));
		expect(game.$schema).toBe(GameProjectGameSchemaReference);
		expect(game.version).toBe(editorTestPayload.version);
		expect(game).not.toHaveProperty("items");
		const waterPath = join(harness.root, "items", "simple", "water.json");
		expect(JSON.parse(await readFile(waterPath, "utf8")).$schema).toBe(
			GameProjectItemSchemaReference,
		);
		const waterResourcePath = join(harness.root, "assets", "item-water.png");
		await mkdir(join(harness.root, ".git"));
		await Promise.all([
			writeFile(join(harness.root, ".git", "config"), "keep-git"),
			writeFile(join(harness.root, "unrelated.txt"), "keep-unrelated"),
		]);
		await writeFile(waterPath, '{"item":{}}');
		await rm(waterResourcePath);
		const repaired = {
			...canonicalInitial,
			marker: {
				...initial.marker,
				revision: 2,
			},
		};
		await harness.write(repaired, initial);
		expect(await harness.read()).toEqual(repaired);

		const next = {
			arkpack: repaired.arkpack,
			marker: {
				...repaired.marker,
				revision: 3,
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
		await expect(readFile(join(harness.root, ".git", "config"), "utf8")).resolves.toBe(
			"keep-git",
		);
		await expect(readFile(join(harness.root, "unrelated.txt"), "utf8")).resolves.toBe(
			"keep-unrelated",
		);
		await expect(
			access(join(harness.root, "items", "simple", "water.json")),
		).rejects.toBeDefined();
		expect(
			JSON.parse(
				await readFile(join(harness.root, "items", "simple", "water%2Enext.json"), "utf8"),
			),
		).toEqual({
			$schema: GameProjectItemSchemaReference,
			item: next.config.items.water,
		});
		expect(await harness.read()).toEqual(next);
	});

	it("rejects a stale root game schema", async () => {
		const harness = await createProjectFilesHarness();
		openHarnesses.push(harness);
		await harness.write({
			arkpack: editorTestPayload.version,
			marker: {
				arkini: ArkiniAppVersion,
				revision: 1,
			},
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		});
		await writeFile(join(harness.root, "schema.json"), "{}\n");

		await expect(harness.read()).rejects.toThrow("does not match the current project schema");
	});

	it("admits only same-major Editor writer provenance without changing project bytes", async () => {
		const harness = await createProjectFilesHarness();
		openHarnesses.push(harness);
		await harness.write({
			arkpack: editorTestPayload.version,
			marker: {
				arkini: ArkiniAppVersion,
				revision: 1,
			},
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		});
		const markerPath = join(harness.root, "project.json");
		const major = ArkiniAppVersion.slice(0, ArkiniAppVersion.indexOf("."));
		await writeFile(
			markerPath,
			`${JSON.stringify({
				arkini: `${major}.999.999`,
				revision: 1,
			})}\n`,
		);
		await expect(harness.read()).resolves.toMatchObject({
			marker: {
				arkini: `${major}.999.999`,
				revision: 1,
			},
		});

		const incompatible = `${JSON.stringify({
			arkini: `${Number(major) + 1}.0.0`,
			revision: 1,
		})}\n`;
		await writeFile(markerPath, incompatible);
		await expect(harness.read()).rejects.toMatchObject({
			_tag: "ArkiniVersionIncompatibleError",
			artifact: "Editor project",
		});
		await expect(readFile(markerPath, "utf8")).resolves.toBe(incompatible);
	});

	it("rejects a mutable project directory symlink instead of writing through it", async () => {
		const harness = await createProjectFilesHarness();
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
				arkpack: editorTestPayload.version,
				marker: {
					arkini: ArkiniAppVersion,
					revision: 1,
				},
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		).rejects.toThrow("must not be a symbolic link");
		await expect(access(join(outside, "simple", "water.json"))).rejects.toBeDefined();
	});
});
