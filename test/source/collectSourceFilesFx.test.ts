import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { collectSourceFilesFx } from "~/engine/source/fx/collectSourceFilesFx";

describe("collectSourceFilesFx", () => {
	it.effect("collects only the current portable project allowlist", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const root = yield* fileSystem.makeTempDirectoryScoped();
			const project = path.join(root, "project");
			const writeFiles = (directory: string, files: ReadonlyArray<string>) =>
				Effect.forEach(files, (relative) => {
					const destination = path.join(directory, relative);
					return fileSystem
						.makeDirectory(path.dirname(destination), {
							recursive: true,
						})
						.pipe(Effect.andThen(fileSystem.writeFileString(destination, "{}")));
				});

			yield* writeFiles(project, [
				"project.json",
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
			const collectRelative = (directory: string) =>
				collectSourceFilesFx({
					input: directory,
				}).pipe(
					Effect.map(({ json, png }) => ({
						json: json.map((file) =>
							path.relative(directory, file).split(path.sep).join("/"),
						),
						png: png.map((file) =>
							path.relative(directory, file).split(path.sep).join("/"),
						),
					})),
				);

			const result = yield* collectRelative(project);

			expect(result).toEqual({
				json: [
					"game.json",
					"items/producer/kept.json",
				],
				png: [
					"assets/kept.png",
				],
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
