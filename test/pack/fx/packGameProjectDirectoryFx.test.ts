import { gunzipSync } from "node:zlib";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Fiber, FileSystem, Path, Ref } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "@effect/vitest";

import { decodeFx } from "~/engine/pack/fx/decodeFx";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import {
	png,
	writeGameProjectFixtureFx,
} from "./packGameProjectDirectoryFx.test/gameProjectFixture";

describe("packDirectoryFx game-project contract", () => {
	it.effect("derives package identity from a portable game project", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const input = yield* writeGameProjectFixtureFx();
			const result = yield* packDirectoryFx({
				input,
			});
			const compressed = yield* fileSystem.readFile(result.arkpack);
			const payload = yield* decodeFx(new Uint8Array(gunzipSync(compressed)));

			expect(result).toMatchObject({
				filename: "project-game.arkpack",
				packageId: "project-game",
				version: "2.3",
				json: 2,
				png: 2,
			});
			expect(payload).toMatchObject({
				version: "2.3",
				config: {
					meta: {
						id: "project-game",
					},
				},
				resources: expect.arrayContaining([
					{
						id: "hero",
						mime: "image/png",
						bytes: png,
					},
					{
						id: "item-water",
						mime: "image/png",
						bytes: png,
					},
				]),
			});
			expect(payload.config).not.toHaveProperty("arkpack");
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
