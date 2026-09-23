import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import {
	GameProjectGameSchemaReference,
	GameProjectItemSchemaReference,
} from "~/game-config-source/constant/GameProjectReference";
import type { ProjectFiles } from "~/project-authoring/filesystem/fx/ProjectFiles";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createProjectFilesHarness } from "./ProjectFiles.test/harness";

const openHarnesses: Array<Awaited<ReturnType<typeof createProjectFilesHarness>>> = [];

afterEach(async () => {
	await Promise.all(openHarnesses.splice(0).map((harness) => harness.close()));
});

describe("filesystem Editor project current tree", () => {
	it("rejects orphaned audio metadata instead of silently dropping it on reopen", async () => {
		const harness = await createProjectFilesHarness();
		openHarnesses.push(harness);
		await harness.write({
			serapack: parseVersionFn(editorTestPayload.version),
			marker: {
				serakki: SerakkiAppVersion,
				revision: 1,
			},
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		});
		await mkdir(join(harness.root, "music"));
		await writeFile(
			join(harness.root, "music", "orphan.json"),
			JSON.stringify({
				name: "Dusty Plains",
			}),
		);
		await expect(harness.read()).rejects.toThrow("requires its paired file");
	});

	it("round-trips and republishes the complete authoritative current tree", async () => {
		const harness = await createProjectFilesHarness();
		openHarnesses.push(harness);
		const initial = {
			serapack: parseVersionFn(editorTestPayload.version),
			marker: {
				serakki: SerakkiAppVersion,
				revision: 1,
			},
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					introduction: "# Welcome\n\nA **new** world.\n\n- Explore",
				},
			},
			resources: editorTestPayload.resources,
		} as const;

		const expectCurrentTreeFn = async (expected: ProjectFiles) => {
			expect(await harness.read()).toEqual({
				...expected,
				resources: expected.resources.map(({ id, type, bytes }) => ({
					id,
					type,
					size: bytes.byteLength,
					version: expect.any(String),
				})),
			});
			for (const resource of expected.resources) {
				const directory = resource.type;
				expect(
					new Uint8Array(
						await readFile(join(harness.root, directory, `${resource.id}.png`)),
					),
				).toEqual(resource.bytes);
			}
		};

		await harness.write(initial);
		const canonicalInitial = {
			...initial,
			config: GameConfigSchema.parse({
				...initial.config,
				$schema: GameProjectGameSchemaReference,
			}),
		};
		await expectCurrentTreeFn(canonicalInitial);
		expect(JSON.parse(await readFile(join(harness.root, "project.json"), "utf8"))).toEqual({
			serakki: SerakkiAppVersion,
			revision: initial.marker.revision,
		});
		const schema = JSON.parse(await readFile(join(harness.root, "schema.json"), "utf8"));
		expect(schema).toMatchObject({
			anyOf: [
				{
					$ref: "urn:serakki:schema:project#/$defs/GameFileSchema",
				},
				{
					$ref: "urn:serakki:schema:project#/$defs/ItemFileSchema",
				},
				{
					$ref: "urn:serakki:schema:project#/$defs/AudioResourceMetadataSchema",
				},
			],
			$defs: {
				GameFileSchema: {
					properties: {
						version: {
							$ref: "urn:serakki:schema:project#/$defs/VersionPartsSchema",
						},
					},
					type: "object",
				},
				ItemFileSchema: {
					properties: {
						item: {
							$ref: "urn:serakki:schema:project#/$defs/ItemSchema",
						},
					},
					type: "object",
				},
			},
		});
		const game = JSON.parse(await readFile(join(harness.root, "game.json"), "utf8"));
		expect(game.$schema).toBe(GameProjectGameSchemaReference);
		expect(game.version).toEqual(parseVersionFn(editorTestPayload.version));
		expect(game).not.toHaveProperty("items");
		const waterPath = join(harness.root, "items", "water.json");
		expect(JSON.parse(await readFile(waterPath, "utf8")).$schema).toBe(
			GameProjectItemSchemaReference,
		);
		const waterResourcePath = join(harness.root, "artwork", "item-water.png");
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
		await expectCurrentTreeFn(repaired);

		const next = {
			serapack: repaired.serapack,
			marker: {
				...repaired.marker,
				revision: 3,
			},
			config: GameConfigSchema.parse({
				...repaired.config,
				templates: repaired.config.templates?.map((template) => ({
					...template,
					board: template.board.map((entry) => ({
						...entry,
						itemUid: "water.\ud800",
					})),
				})),
				items: {
					["water.\ud800"]: {
						...initial.config.items.water,
						uid: "water.\ud800",
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
		await expect(access(join(harness.root, "items", "water.json"))).rejects.toBeDefined();
		expect(
			JSON.parse(
				await readFile(join(harness.root, "items", "water%2E%ED%A0%80.json"), "utf8"),
			),
		).toEqual({
			$schema: GameProjectItemSchemaReference,
			item: next.config.items["water.\ud800"],
		});
		await expectCurrentTreeFn(next);
	});

	it("rejects a stale root game schema", async () => {
		const harness = await createProjectFilesHarness();
		openHarnesses.push(harness);
		await harness.write({
			serapack: parseVersionFn(editorTestPayload.version),
			marker: {
				serakki: SerakkiAppVersion,
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
			serapack: parseVersionFn(editorTestPayload.version),
			marker: {
				serakki: SerakkiAppVersion,
				revision: 1,
			},
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		});
		const markerPath = join(harness.root, "project.json");
		const major = SerakkiAppVersion.slice(0, SerakkiAppVersion.indexOf("."));
		await writeFile(
			markerPath,
			`${JSON.stringify({
				serakki: `${major}.999.999`,
				revision: 1,
			})}\n`,
		);
		await expect(harness.read()).resolves.toMatchObject({
			marker: {
				serakki: `${major}.999.999`,
				revision: 1,
			},
		});

		const incompatible = `${JSON.stringify({
			serakki: `${Number(major) + 1}.0.0`,
			revision: 1,
		})}\n`;
		await writeFile(markerPath, incompatible);
		await expect(harness.read()).rejects.toMatchObject({
			_tag: "SerakkiVersionIncompatibleError",
			artifact: "Editor project",
		});
		await expect(readFile(markerPath, "utf8")).resolves.toBe(incompatible);
	});
});
