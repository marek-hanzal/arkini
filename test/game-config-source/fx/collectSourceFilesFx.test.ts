import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { collectSourceFilesFx } from "~/game-config-source/fx/collectSourceFilesFx";

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
				"items/kept.json",
				"items/nested/ignored.json",
				"artwork/kept.png",
				"image/hero.png",
				"image/nested/ignored.png",
				"music/theme.ogg",
				"music/theme.json",
				"music/nested/ignored.json",
				"music/ignored.OGG",
				"music/nested/ignored.ogg",
				"sfx/job-start.ogg",
				"sfx/job-start.json",
				"sfx/ignored.mp3",
				"assets/obsolete.png",
				"resources/obsolete.png",
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
					Effect.map(({ json, resources, audioMetadata }) => ({
						audioMetadata: audioMetadata.map((file) =>
							path.relative(directory, file).split(path.sep).join("/"),
						),
						json: json.map((file) =>
							path.relative(directory, file).split(path.sep).join("/"),
						),
						resources: resources.map((resource) => ({
							path: path.relative(directory, resource.path).split(path.sep).join("/"),
							type: resource.type,
						})),
					})),
				);

			const result = yield* collectRelative(project);

			expect(result).toEqual({
				audioMetadata: [
					"music/theme.json",
					"sfx/job-start.json",
				],
				json: [
					"game.json",
					"items/kept.json",
				],
				resources: [
					{
						path: "artwork/kept.png",
						type: "artwork",
					},
					{
						path: "image/hero.png",
						type: "image",
					},
					{
						path: "music/theme.ogg",
						type: "music",
					},
					{
						path: "sfx/job-start.ogg",
						type: "sfx",
					},
				],
			});
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
