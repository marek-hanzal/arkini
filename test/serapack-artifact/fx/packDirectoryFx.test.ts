import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";
import sharp from "sharp";

import { decodeTestSerapackPayloadFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { decodeTestSerapackEnvelopeFx } from "~test/serapack-support/fx/testSerapackCodecFx";
import { packDirectoryFx } from "~/serapack-artifact/fx/packDirectoryFx";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import {
	assetPng,
	musicOgg,
	png,
	sfxOgg,
	writeGameProjectFixtureFx,
} from "./packDirectoryFx.test/gameProjectFixture";

describe("packDirectoryFx game-project contract", () => {
	it.effect("stamps the source revision so a new revision changes the package identity", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			const before = yield* packDirectoryFx({
				input,
			});
			const beforeLayout = yield* readSerapackFileLayoutFx(before.serapack);
			yield* fileSystem.writeFileString(
				path.join(input, "project.json"),
				JSON.stringify({
					serakki: beforeLayout.manifest.serakki,
					revision: 2,
				}),
			);
			const after = yield* packDirectoryFx({
				input,
			});
			expect(after.contentHash).not.toBe(before.contentHash);
			expect((yield* readSerapackFileLayoutFx(after.serapack)).manifest.projectRevision).toBe(
				2,
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("keeps the packed payload and content hash identical after audio names change", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			const before = yield* packDirectoryFx({
				input,
			});
			const beforeEnvelope = yield* decodeTestSerapackEnvelopeFx(
				yield* fileSystem.readFile(before.serapack),
			);
			for (const relative of [
				"music/theme.json",
				"sfx/job-start.json",
			])
				yield* fileSystem.writeFileString(
					path.join(input, relative),
					JSON.stringify({
						name: "A completely different Editor name",
					}),
				);
			const after = yield* packDirectoryFx({
				input,
			});
			const afterEnvelope = yield* decodeTestSerapackEnvelopeFx(
				yield* fileSystem.readFile(after.serapack),
			);
			expect(afterEnvelope.payload).toEqual(beforeEnvelope.payload);
			expect(after.contentHash).toBe(before.contentHash);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("rejects missing metadata even for Music excluded from the playlist", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			yield* fileSystem.remove(path.join(input, "music", "unused-theme.json"));
			const result = yield* Effect.result(
				packDirectoryFx({
					input,
				}),
			);
			expect(result).toMatchObject({
				_tag: "Failure",
				failure: {
					_tag: "GameValidationError",
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							issueCode: "audio-resource-metadata-missing",
							source: expect.stringMatching(/unused-theme\.json$/),
						}),
					]),
				},
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("derives package identity from a portable game project", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const input = yield* writeGameProjectFixtureFx();
			const result = yield* packDirectoryFx({
				input,
			});
			const layout = yield* readSerapackFileLayoutFx(result.serapack);
			expect(layout.manifest.projectRevision).toBe(1);
			const serapack = yield* fileSystem.readFile(result.serapack);
			const envelope = yield* decodeTestSerapackEnvelopeFx(serapack);
			const payload = yield* decodeTestSerapackPayloadFx(envelope.payload);
			// Editor sidecars must never become package JSON or raw body entries.
			expect(new TextDecoder().decode(envelope.payload)).not.toContain("Editor-only");

			expect(result).toMatchObject({
				filename: "project-game.serapack",
				packageId: "project-game",
				version: "2.3",
				json: 3,
				resources: 4,
			});
			expect(payload).toMatchObject({
				version: "2.3",
				config: {
					meta: {
						id: "project-game",
					},
				},
			});
			const hero = payload.resources.find(({ id }) => id === "hero");
			const itemWater = payload.resources.find(({ id }) => id === "item-water");
			if (itemWater === undefined) throw new Error("Missing packed item-water asset.");
			expect(hero).toEqual({
				id: "hero",
				type: "image",
				bytes: png,
			});
			expect(payload.resources).toContainEqual({
				id: "theme",
				type: "music",
				bytes: musicOgg,
			});
			expect(payload.resources.some(({ id }) => id === "unused-theme")).toBe(false);
			expect(payload.resources).toContainEqual({
				id: "job-start",
				type: "sfx",
				bytes: sfxOgg,
			});
			expect(itemWater).toMatchObject({
				id: "item-water",
				type: "artwork",
			});
			expect(itemWater.bytes).not.toEqual(assetPng);
			const normalized = yield* Effect.promise(() =>
				sharp(itemWater.bytes).raw().toBuffer({
					resolveWithObject: true,
				}),
			);
			expect(normalized.info).toMatchObject({
				width: 512,
				height: 512,
				channels: 4,
				hasAlpha: true,
			});
			expect(normalized.data[3]).toBe(128);
			expect(payload.config).not.toHaveProperty("serapack");
			expect(payload.config.items.water?.artwork.scale).toBe(0.65);
			expect(payload.config.items.portal?.artwork.scale).toBe(1);
			expect(payload.config.items.portal).toMatchObject({
				lines: [
					{
						id: "travel",
						title: "Travel",
						description: "Travel",
						default: true,
						runtimeMs: 0,
						input: [
							{
								type: "simple",
							},
						],
						rules: [],
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "space",
													space: 9,
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					},
				],
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("rejects a directory without the required project marker", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			yield* fileSystem.remove(path.join(input, "project.json"));
			const result = yield* Effect.result(
				packDirectoryFx({
					input,
				}),
			);

			expect(result).toMatchObject({
				_tag: "Failure",
				failure: {
					_tag: "GameValidationError",
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							issueCode: "game-project-manifest-missing",
							source: expect.stringMatching(/project\.json$/),
						}),
					]),
				},
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("rejects an invalid project manifest", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			yield* fileSystem.writeFileString(
				path.join(input, "project.json"),
				JSON.stringify({
					unknown: true,
				}),
			);
			const result = yield* Effect.result(
				packDirectoryFx({
					input,
				}),
			);

			expect(result).toMatchObject({
				_tag: "Failure",
				failure: {
					_tag: "GameValidationError",
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							source: expect.stringMatching(/project\.json$/),
						}),
					]),
				},
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("rejects a stale project schema", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			yield* fileSystem.writeFileString(path.join(input, "schema.json"), "{}");
			const result = yield* Effect.result(
				packDirectoryFx({
					input,
				}),
			);

			expect(result).toMatchObject({
				_tag: "Failure",
				failure: {
					_tag: "GameValidationError",
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							source: expect.stringMatching(/schema\.json$/),
						}),
					]),
				},
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("rejects an item file whose filename does not match its UID", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			const itemDirectory = path.join(input, "items");
			yield* fileSystem.rename(
				path.join(itemDirectory, "water.json"),
				path.join(itemDirectory, "wrong.json"),
			);
			const result = yield* Effect.result(
				packDirectoryFx({
					input,
				}),
			);

			expect(result).toMatchObject({
				_tag: "Failure",
				failure: {
					_tag: "GameValidationError",
					diagnostics: expect.arrayContaining([
						expect.objectContaining({
							message: expect.stringContaining("requires filename"),
							source: expect.stringMatching(/wrong\.json$/),
						}),
					]),
				},
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
