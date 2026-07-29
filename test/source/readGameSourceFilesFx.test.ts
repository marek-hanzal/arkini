import { FileSystem, Path } from "effect";
import { NodeServices } from "@effect/platform-node";
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

	it("reports an invalid footprint dimension at its exact source path", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const input = yield* fileSystem.makeTempDirectoryScoped();
				yield* fileSystem.writeFileString(
					path.join(input, "invalid-footprint.json"),
					JSON.stringify({
						items: {
							"item:a": {
								id: "item:a",
								title: "A",
								description: "A",
								asset: {
									source: [
										"asset:a",
									],
								},
								tags: [],
								categoryId: "category:test",
								scope: "any",
								maxStackSize: 1,
								type: "simple",
								footprint: {
									width: 0,
									height: 2,
								},
							},
						},
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
					code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
					path: [
						"items",
						"item:a",
						"footprint",
						"width",
					],
					source: expect.stringContaining("invalid-footprint.json"),
				}),
			]),
		);
	});
});
