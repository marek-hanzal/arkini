import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { optimizePngResourceFileFx } from "~/game-config-resource/fx/optimizePngResourceFileFx";

const pixels = Uint8Array.of(240, 120, 60, 0, 12, 34, 56, 255, 90, 80, 70, 128, 0, 0, 0, 0);
const optimizedPixels = Uint8Array.of(0, 0, 0, 0, 12, 34, 56, 255, 90, 80, 70, 128, 0, 0, 0, 0);

describe("PNG resource file optimization", () => {
	it("streams a lossless result and clears color below zero alpha", async () => {
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const fileSystem = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* fileSystem.makeTempDirectoryScoped();
					const source = path.join(root, "source.png");
					const original = yield* Effect.promise(() =>
						sharp(pixels, {
							raw: {
								channels: 4,
								height: 2,
								width: 2,
							},
						})
							.png({
								adaptiveFiltering: false,
								compressionLevel: 0,
								palette: false,
							})
							.toBuffer(),
					);
					yield* fileSystem.writeFile(source, original);

					const first = yield* optimizePngResourceFileFx(
						source,
						path.join(root, "first"),
						"dirty",
					);
					const metadata = yield* Effect.promise(() => sharp(first.path).metadata());
					const decoded = yield* Effect.promise(() =>
						sharp(first.path).ensureAlpha().raw().toBuffer(),
					);

					expect(metadata).toMatchObject({
						channels: 4,
						height: 2,
						width: 2,
					});
					expect(decoded).toEqual(Buffer.from(optimizedPixels));
					expect(first.changed).toBe(true);
					expect(first.optimizedBytes).toBeLessThan(first.originalBytes);

					const second = yield* optimizePngResourceFileFx(
						first.path,
						path.join(root, "second"),
						"dirty",
					);
					expect(second.changed).toBe(false);
				}),
			).pipe(Effect.provide(NodeServices.layer)),
		);
	});
});
