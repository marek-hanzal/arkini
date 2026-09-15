import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";
import sharp from "sharp";

import { decodeTestArkpackPayloadFx } from "~test/arkpack-support/fx/testArkpackCodecFx";
import { decodeTestArkpackEnvelopeFx } from "~test/arkpack-support/fx/testArkpackCodecFx";
import { packDirectoryFx } from "~/arkpack-artifact/fx/packDirectoryFx";
import {
	assetPng,
	musicOgg,
	png,
	writeGameProjectFixtureFx,
} from "./packDirectoryFx.test/gameProjectFixture";

describe("packDirectoryFx game-project contract", () => {
	it.effect("derives package identity from a portable game project", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const input = yield* writeGameProjectFixtureFx();
			const result = yield* packDirectoryFx({
				input,
			});
			const arkpack = yield* fileSystem.readFile(result.arkpack);
			const envelope = yield* decodeTestArkpackEnvelopeFx(arkpack);
			const payload = yield* decodeTestArkpackPayloadFx(envelope.payload);

			expect(result).toMatchObject({
				filename: "project-game.arkpack",
				packageId: "project-game",
				version: "2.3",
				json: 3,
				resources: 3,
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
				width: 256,
				height: 256,
				channels: 4,
				hasAlpha: true,
			});
			expect(normalized.data[3]).toBe(128);
			expect(payload.config).not.toHaveProperty("arkpack");
			expect(payload.config.items.water?.artwork.scale).toBe(0.65);
			expect(payload.config.items.portal?.artwork.scale).toBe(1);
			expect(payload.config.items.portal).toMatchObject({
				action: {
					type: "space" as const,
					space: 9,
				},
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
