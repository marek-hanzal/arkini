import { gunzipSync } from "node:zlib";
import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decodeFx } from "./decodeFx";
import { packDirectoryFx } from "./packDirectoryFx";

const png = new Uint8Array([
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
]);

describe("packDirectoryFx", () => {
	it("packs recursive JSON sources and PNG assets", async () => {
		const packed = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const directory = yield* fileSystem.makeTempDirectoryScoped();
				const input = path.join(directory, "arkini");
				const items = path.join(input, "items");
				const assets = path.join(input, "assets");

				yield* fileSystem.makeDirectory(items, {
					recursive: true,
				});
				yield* fileSystem.makeDirectory(assets, {
					recursive: true,
				});
				yield* fileSystem.writeFileString(
					path.join(input, "game.json"),
					JSON.stringify({
						version: "1.0",
						meta: {
							id: "arkini",
							title: "Arkini",
							board: {
								width: 7,
								height: 11,
							},
							inventory: {
								width: 7,
								height: 7,
							},
						},
						categories: {},
					}),
				);
				yield* fileSystem.writeFileString(
					path.join(items, "log.json"),
					JSON.stringify({
						items: {},
					}),
				);
				yield* fileSystem.writeFile(path.join(assets, "item-log.png"), png);

				const result = yield* packDirectoryFx({
					input,
				});
				const compressed = yield* fileSystem.readFile(result.output);
				const payload = yield* decodeFx(new Uint8Array(gunzipSync(compressed)));

				return {
					result,
					payload,
				} as const;
			}).pipe(Effect.provide(NodeContext.layer), Effect.scoped),
		);

		expect(packed.result).toMatchObject({
			json: 2,
			png: 1,
		});
		expect(packed.payload.resources).toEqual([
			{
				id: "item-log",
				mime: "image/png",
				bytes: png,
			},
		]);
	});
});
