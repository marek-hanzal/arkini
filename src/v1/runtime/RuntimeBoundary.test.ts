import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const internalStoreImport = 'from "~/v1/runtime/internal/RuntimeStoreFx"';
const allowedImporters = new Set([
	"src/v1/runtime/RuntimeBoundary.test.ts",
	"src/v1/game/layer/GameLayerFx.ts",
	"src/v1/placement/write/placeOutputFx.ts",
	"src/v1/runtime/write/moveItemFx.ts",
	"src/v1/runtime/write/removeItemFx.ts",
	"src/v1/runtime/write/setItemQuantityFx.ts",
	"src/v1/runtime/write/spawnItemFx.ts",
	"src/v1/runtime/write/swapItemsFx.ts",
]);

const collectTypeScriptFilesFx = (
	directory: string,
): Effect.Effect<string[], Error, FileSystem.FileSystem> => {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const entries = yield* fileSystem.readDirectory(directory);
		const files = yield* Effect.forEach(entries, (entry) => {
			const path = `${directory}/${entry}`;

			return fileSystem.stat(path).pipe(
				Effect.flatMap((stat) => {
					if (stat.type === "Directory") {
						return collectTypeScriptFilesFx(path);
					}

					return Effect.succeed(
						path.endsWith(".ts")
							? [
									path,
								]
							: [],
					);
				}),
			);
		});

		return files.flat();
	});
};

describe("runtime mutation boundary", () => {
	it("keeps the mutable runtime store inside the layer and dedicated commands", async () => {
		const invalidImporters = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const files = yield* collectTypeScriptFilesFx("src/v1");
				const importers = yield* Effect.filter(files, (file) => {
					return fileSystem
						.readFileString(file)
						.pipe(Effect.map((source) => source.includes(internalStoreImport)));
				});

				return importers.filter((file) => !allowedImporters.has(file));
			}).pipe(Effect.provide(NodeContext.layer)),
		);

		expect(invalidImporters).toEqual([]);
	});
});
