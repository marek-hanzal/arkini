import { gunzipSync } from "node:zlib";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, FileSystem, Path, Ref } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "@effect/vitest";
import sharp from "sharp";

import { decodeFx } from "~/arkpack-artifact/fx/decodeFx";
import { decodeArkpackEnvelopeFx } from "~/arkpack-artifact/fx/decodeArkpackEnvelopeFx";
import { packDirectoryFx } from "~/arkpack-artifact/fx/packDirectoryFx";
import {
	assetPng,
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
			const envelope = yield* decodeArkpackEnvelopeFx(arkpack);
			const payload = yield* decodeFx(new Uint8Array(gunzipSync(envelope.payload)));

			expect(result).toMatchObject({
				filename: "project-game.arkpack",
				packageId: "project-game",
				version: "2.3",
				json: 3,
				png: 2,
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
				mime: "image/png",
				bytes: png,
			});
			expect(itemWater).toMatchObject({
				id: "item-water",
				mime: "image/png",
			});
			expect(itemWater.bytes).not.toEqual(assetPng);
			const normalized = yield* Effect.promise(() =>
				sharp(itemWater.bytes).raw().toBuffer({
					resolveWithObject: true,
				}),
			);
			expect(normalized.info).toMatchObject({
				width: 256,
				height: 64,
				channels: 4,
				hasAlpha: true,
			});
			expect(normalized.data[3]).toBe(128);
			expect(payload.config).not.toHaveProperty("arkpack");
			expect(payload.config.items.portal).toMatchObject({
				type: "space",
				space: 9,
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

	it.effect("refuses to pack an interrupted portable Editor tree", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			const recovery = path.join(input, "editor.lock.write");
			yield* fileSystem.makeDirectory(recovery);
			const result = yield* Effect.result(
				packDirectoryFx({
					input,
				}),
			);

			expect(result).toMatchObject({
				_tag: "Failure",
				failure: {
					message: expect.stringContaining("reopen it in the Editor before packing"),
				},
			});
			expect(yield* fileSystem.exists(path.join(input, "build"))).toBe(false);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("rejects an item file whose filename does not match its UID", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			const itemDirectory = path.join(input, "items", "simple");
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

	it.effect("serializes concurrent project builds before the freshness assertion", () =>
		Effect.gen(function* () {
			const input = yield* writeGameProjectFixtureFx();
			const firstEntered = yield* Deferred.make<void>();
			const releaseFirst = yield* Deferred.make<void>();
			const secondEntered = yield* Ref.make(false);
			const first = yield* packDirectoryFx({
				input,
				assertCurrentFx: Deferred.succeed(firstEntered, undefined).pipe(
					Effect.andThen(Deferred.await(releaseFirst)),
				),
			}).pipe(Effect.forkChild);
			yield* Deferred.await(firstEntered);
			const second = yield* packDirectoryFx({
				input,
				assertCurrentFx: Ref.set(secondEntered, true),
			}).pipe(Effect.forkChild);
			yield* TestClock.adjust("100 millis");
			const enteredWhileLocked = yield* Ref.get(secondEntered);
			yield* Deferred.succeed(releaseFirst, undefined);
			const firstResult = yield* Fiber.join(first);
			yield* TestClock.adjust("100 millis");
			const secondResult = yield* Fiber.join(second);

			expect(enteredWhileLocked).toBe(false);
			expect([
				firstResult.filename,
				secondResult.filename,
			]).toEqual([
				"project-game.arkpack",
				"project-game.arkpack",
			]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
