import { FileSystem, Path } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { readGameSourceFilesFx } from "~/game-config-compiler/fx/readGameSourceFilesFx";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

describe("readGameSourceFilesFx", () => {
	it.effect(
		"rejects missing, orphaned and invalid audio metadata without opening audio bodies",
		() =>
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* fileSystem.makeTempDirectoryScoped();
				for (const directory of [
					"music",
					"sfx",
				])
					yield* fileSystem.makeDirectory(path.join(input, directory));
				for (const [relative, source] of [
					[
						"music/valid.ogg",
						"unopened audio",
					],
					[
						"music/valid.json",
						'{"name":"Dusty Plains"}',
					],
					[
						"music/missing.ogg",
						"unopened audio",
					],
					[
						"sfx/orphan.json",
						'{"name":"Lost Bell"}',
					],
					[
						"sfx/invalid.ogg",
						"unopened audio",
					],
					[
						"sfx/invalid.json",
						'{"name":"  "}',
					],
					[
						"sfx/malformed.ogg",
						"unopened audio",
					],
					[
						"sfx/malformed.json",
						"{bad json",
					],
					[
						"music/unknown.ogg",
						"unopened audio",
					],
					[
						"music/unknown.json",
						'{"name":"Track","extra":true}',
					],
				] as const)
					yield* fileSystem.writeFileString(path.join(input, relative), source);
				const result = yield* readGameSourceFilesFx({
					input,
				}).pipe(
					Effect.provideService(FileSystem.FileSystem, {
						...fileSystem,
						readFileString: (file, options) =>
							file.endsWith(".ogg")
								? Effect.die("Audio body read during metadata discovery")
								: fileSystem.readFileString(file, options),
						readFile: (file) =>
							file.endsWith(".ogg")
								? Effect.die("Audio body read during metadata discovery")
								: fileSystem.readFile(file),
					}),
				);
				const diagnostics = result.diagnostics.filter(
					({ source }) =>
						source?.includes(`${path.sep}music${path.sep}`) ||
						source?.includes(`${path.sep}sfx${path.sep}`),
				);
				expect(diagnostics).toHaveLength(5);
				expect(diagnostics).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							source: path.join(input, "music/missing.json"),
							issueCode: "audio-resource-metadata-missing",
						}),
						expect.objectContaining({
							source: path.join(input, "sfx/orphan.json"),
							issueCode: "audio-resource-body-missing",
						}),
						expect.objectContaining({
							source: path.join(input, "sfx/invalid.json"),
							path: [
								"name",
							],
							code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
						}),
						expect.objectContaining({
							source: path.join(input, "sfx/malformed.json"),
							code: DiagnosticCodeEnumSchema.enum.SourceJsonInvalid,
						}),
						expect.objectContaining({
							source: path.join(input, "music/unknown.json"),
							code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
						}),
					]),
				);
			}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("collects JSON syntax and fragment-schema diagnostics across files", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const input = yield* fileSystem.makeTempDirectoryScoped();
			yield* fileSystem.makeDirectory(path.join(input, "items"), {
				recursive: true,
			});
			yield* fileSystem.writeFileString(
				path.join(input, "project.json"),
				JSON.stringify({
					arkini: ArkiniAppVersion,
					revision: 1,
				}),
			);
			yield* fileSystem.writeFileString(
				path.join(input, "schema.json"),
				JSON.stringify(GameProjectJsonSchema),
			);
			yield* fileSystem.writeFileString(path.join(input, "items", "broken.json"), "{ nope");
			yield* fileSystem.writeFileString(
				path.join(input, "items", "invalid.json"),
				JSON.stringify({
					item: [],
				}),
			);
			const result = yield* readGameSourceFilesFx({
				input,
			});

			expect(result.sources).toEqual([]);
			expect(result.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: DiagnosticCodeEnumSchema.enum.SourceJsonInvalid,
						source: expect.stringContaining("broken.json"),
					}),
					expect.objectContaining({
						code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
						source: expect.stringContaining("invalid.json"),
					}),
				]),
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
