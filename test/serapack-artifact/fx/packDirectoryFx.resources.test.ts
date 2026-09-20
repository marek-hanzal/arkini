import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { packDirectoryFx } from "~/serapack-artifact/fx/packDirectoryFx";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import {
	decodeTestSerapackEnvelopeFx,
	decodeTestSerapackPayloadFx,
} from "~test/serapack-support/fx/testSerapackCodecFx";
import {
	musicOgg,
	png,
	sfxOgg,
	writeGameProjectFixtureFx,
} from "./packDirectoryFx.test/gameProjectFixture";

describe("packDirectoryFx resource isolation", () => {
	it.effect("packages item-requested music outside the global playlist", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			const itemPath = path.join(input, "items", "water.json");
			const item = JSON.parse(yield* fs.readFileString(itemPath));
			yield* fs.writeFileString(
				itemPath,
				JSON.stringify({
					...item,
					item: {
						...item.item,
						music: "unused-theme",
					},
				}),
			);
			const result = yield* packDirectoryFx({
				input,
			});
			const envelope = yield* decodeTestSerapackEnvelopeFx(
				yield* fs.readFile(result.serapack),
			);
			const payload = yield* decodeTestSerapackPayloadFx(envelope.payload);
			expect(payload.resources.find(({ id }) => id === "unused-theme")?.bytes).toEqual(
				Uint8Array.from(musicOgg),
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect(
		"keeps admitted media bytes when external editors replace the source files during Build",
		() =>
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* fileSystem.realPath(yield* writeGameProjectFixtureFx());
				const sources = [
					path.join(input, "image", "hero.png"),
					path.join(input, "music", "theme.ogg"),
					path.join(input, "sfx", "job-start.ogg"),
				];
				const replaced = new Set<string>();
				const result = yield* packDirectoryFx({
					input,
				}).pipe(
					Effect.provideService(FileSystem.FileSystem, {
						...fileSystem,
						copyFile: (source, target) =>
							fileSystem
								.copyFile(source, target)
								.pipe(
									Effect.tap(() =>
										sources.includes(source)
											? fileSystem
													.writeFileString(source, "external replacement")
													.pipe(
														Effect.tap(() =>
															Effect.sync(() => replaced.add(source)),
														),
													)
											: Effect.void,
									),
								),
					}),
				);
				expect(replaced).toEqual(new Set(sources));
				const bytes = yield* fileSystem.readFile(result.serapack);
				const envelope = yield* decodeTestSerapackEnvelopeFx(bytes);
				const payload = yield* decodeTestSerapackPayloadFx(envelope.payload);
				expect(payload.resources.find(({ id }) => id === "hero")?.bytes).toEqual(png);
				expect(payload.resources.find(({ id }) => id === "theme")?.bytes).toEqual(
					Uint8Array.from(musicOgg),
				);
				expect(payload.resources.find(({ id }) => id === "job-start")?.bytes).toEqual(
					Uint8Array.from(sfxOgg),
				);
				const layout = yield* readSerapackFileLayoutFx(result.serapack);
				expect(result.bytes).toBe(bytes.byteLength);
				expect(layout.contentHash).toBe(result.contentHash);
			}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("keeps the previous artifact when the copied resource fails admission", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* writeGameProjectFixtureFx();
			const previous = yield* packDirectoryFx({
				input,
			});
			const previousBytes = yield* fileSystem.readFile(previous.serapack);
			const source = path.join(input, "image", "hero.png");
			yield* fileSystem.writeFileString(source, "incomplete external PNG save");
			const result = yield* Effect.result(
				packDirectoryFx({
					input,
				}),
			);
			expect(result).toMatchObject({
				_tag: "Failure",
			});
			expect(yield* fileSystem.readFile(previous.serapack)).toEqual(previousBytes);
			expect(
				(yield* fileSystem.readDirectory(input)).some((name) =>
					name.startsWith(".serapack-build."),
				),
			).toBe(false);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
