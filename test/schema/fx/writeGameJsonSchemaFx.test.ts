import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { writeGameJsonSchemaFx } from "~/v1/schema/fx/writeGameJsonSchemaFx";

describe("writeGameJsonSchemaFx", () => {
	it("writes the JSON Schema for split game-source fragments", async () => {
		const jsonSchema = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const directory = yield* fileSystem.makeTempDirectoryScoped();
				const output = path.join(directory, "schema.json");

				yield* writeGameJsonSchemaFx({
					output,
				});

				return yield* fileSystem.readFileString(output);
			}).pipe(Effect.provide(NodeContext.layer), Effect.scoped),
		);
		const schema = JSON.parse(jsonSchema);

		expect(schema).toMatchObject({
			type: "object",
			properties: {
				items: {
					type: "object",
					additionalProperties: {
						$ref: "#/$defs/ItemSchema",
					},
				},
				meta: {
					$ref: expect.stringMatching(/^#\/\$defs\//),
				},
				start: {
					$ref: expect.stringMatching(/^#\/\$defs\//),
				},
				version: {
					$ref: expect.stringMatching(/^#\/\$defs\//),
				},
			},
		});
		expect(Object.keys(schema.$defs ?? {})).not.toContain(
			expect.stringMatching(/^__schema\d+$/),
		);
		expect(schema.$defs).toHaveProperty("ItemSchema");
		expect(schema.$defs.StartSchema).toMatchObject({
			required: expect.arrayContaining([
				"currentSpace",
			]),
			properties: {
				currentSpace: {
					$ref: expect.stringMatching(/^#\/\$defs\//),
				},
			},
		});
		expect(jsonSchema.length).toBeLessThan(1_000_000);
	});
});
