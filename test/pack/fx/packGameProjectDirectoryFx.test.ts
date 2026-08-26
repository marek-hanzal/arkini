import { gunzipSync } from "node:zlib";
import { FileSystem, Path } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decodeFx } from "~/engine/pack/fx/decodeFx";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import {
	png,
	writeGameProjectFixtureFx,
} from "./packGameProjectDirectoryFx.test/gameProjectFixture";

describe("packDirectoryFx game-project contract", () => {
	it("derives package identity from a portable game project", async () => {
		const packed = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const input = yield* writeGameProjectFixtureFx();
				const result = yield* packDirectoryFx({
					input,
				});
				const compressed = yield* fileSystem.readFile(result.output);
				const payload = yield* decodeFx(new Uint8Array(gunzipSync(compressed)));
				return {
					payload,
					result,
				} as const;
			}).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
		);

		expect(packed.result).toMatchObject({
			packageId: "project-game",
			version: "2.3",
			json: 2,
			png: 2,
		});
		expect(packed.payload).toMatchObject({
			packageId: "project-game",
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
		expect(packed.payload.config).not.toHaveProperty("arkpack");
	});

	it("rejects a directory without the required project marker", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* writeGameProjectFixtureFx();
				yield* fileSystem.remove(path.join(input, "project.json"));
				return yield* Effect.result(
					packDirectoryFx({
						input,
					}),
				);
			}).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
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
	});

	it("rejects an invalid project manifest", async () => {
		const result = await Effect.runPromise(
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
				return yield* Effect.result(
					packDirectoryFx({
						input,
					}),
				);
			}).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
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
	});

	it("rejects a stale project schema", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* writeGameProjectFixtureFx();
				yield* fileSystem.writeFileString(path.join(input, "schema.json"), "{}");
				return yield* Effect.result(
					packDirectoryFx({
						input,
					}),
				);
			}).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
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
	});

	it("rejects an item file whose filename does not match its UID", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* writeGameProjectFixtureFx();
				const itemDirectory = path.join(input, "items", "simple");
				yield* fileSystem.rename(
					path.join(itemDirectory, "water.json"),
					path.join(itemDirectory, "wrong.json"),
				);
				return yield* Effect.result(
					packDirectoryFx({
						input,
					}),
				);
			}).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
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
	});
});
