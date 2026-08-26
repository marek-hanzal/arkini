import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vitest";

import { collectSourceFilesFx } from "~/engine/source/fx/collectSourceFilesFx";

describe("collectSourceFilesFx", () => {
	it("uses the Editor allowlist without changing recursive legacy discovery", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* fileSystem.makeTempDirectoryScoped();
				const editor = path.join(root, "editor");
				const legacy = path.join(root, "legacy");
				const writeFiles = (directory: string, files: ReadonlyArray<string>) =>
					Effect.forEach(files, (relative) => {
						const destination = path.join(directory, relative);
						return fileSystem
							.makeDirectory(path.dirname(destination), {
								recursive: true,
							})
							.pipe(Effect.andThen(fileSystem.writeFileString(destination, "{}")));
					});

				yield* writeFiles(editor, [
					"editor.json",
					"game.json",
					"items/producer/kept.json",
					"items/producer/nested/ignored.json",
					"assets/kept.png",
					"resources/nested/ignored.png",
					"notes/ignored.json",
					"scenarios/ignored.json",
					"versions/version-1/ignored.json",
					"objects/hash/ignored.json",
					"objects/hash/ignored.png",
					"ignored.json",
					"ignored.png",
				]);
				yield* writeFiles(legacy, [
					"schema.json",
					"notes/nested.json",
					"objects/nested.png",
				]);

				const collectRelative = (directory: string) =>
					collectSourceFilesFx({
						input: directory,
					}).pipe(
						Effect.map(({ json, png }) => ({
							json: json.map((file) => path.relative(directory, file)),
							png: png.map((file) => path.relative(directory, file)),
						})),
					);

				return {
					editor: yield* collectRelative(editor),
					legacy: yield* collectRelative(legacy),
				};
			}).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
		);

		expect(result.editor).toEqual({
			json: [
				"game.json",
				"items/producer/kept.json",
			],
			png: [
				"assets/kept.png",
			],
		});
		expect(result.legacy).toEqual({
			json: [
				"notes/nested.json",
			],
			png: [
				"objects/nested.png",
			],
		});
	});
});
