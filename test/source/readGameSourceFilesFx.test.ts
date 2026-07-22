import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readGameSourceFilesFx } from "~/engine/compiler/fx/readGameSourceFilesFx";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";

describe("readGameSourceFilesFx", () => {
	it("collects JSON syntax and fragment-schema diagnostics across files", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* fileSystem.makeTempDirectoryScoped();
				yield* fileSystem.writeFileString(path.join(input, "broken.json"), "{ nope");
				yield* fileSystem.writeFileString(
					path.join(input, "invalid.json"),
					JSON.stringify({
						items: [],
					}),
				);
				return yield* readGameSourceFilesFx({
					input,
				});
			}).pipe(Effect.provide(NodeContext.layer), Effect.scoped),
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
