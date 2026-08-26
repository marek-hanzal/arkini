import { FileSystem, Path } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readGameSourceFilesFx } from "~/engine/compiler/fx/readGameSourceFilesFx";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { createGameProjectJsonSchema } from "~/engine/schema/fx/writeGameProjectJsonSchemaFx";
import { ArkiniAppVersion } from "../../shared/ArkiniAppMetadata";

describe("readGameSourceFilesFx", () => {
	it("collects JSON syntax and fragment-schema diagnostics across files", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* fileSystem.makeTempDirectoryScoped();
				yield* fileSystem.makeDirectory(path.join(input, "items", "simple"), {
					recursive: true,
				});
				yield* fileSystem.writeFileString(
					path.join(input, "project.json"),
					JSON.stringify({
						arkini: ArkiniAppVersion,
						updatedAtMs: 1,
					}),
				);
				yield* fileSystem.writeFileString(
					path.join(input, "schema.json"),
					JSON.stringify(createGameProjectJsonSchema()),
				);
				yield* fileSystem.writeFileString(
					path.join(input, "items", "simple", "broken.json"),
					"{ nope",
				);
				yield* fileSystem.writeFileString(
					path.join(input, "items", "simple", "invalid.json"),
					JSON.stringify({
						items: [],
					}),
				);
				return yield* readGameSourceFilesFx({
					input,
				});
			}).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
		);

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
	});
});
