import { FileSystem, Path } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { z } from "zod";

import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { writeGameProjectJsonSchemaFx } from "~/game-config-source/fx/writeGameProjectJsonSchemaFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { expectNamedJsonSchemaGraph } from "~test/support/expectNamedJsonSchemaGraph";

describe("writeGameProjectJsonSchemaFx", () => {
	it("exports resolvable named public schema graphs", () => {
		const schemas = [
			[
				z.toJSONSchema(GameConfigSchema, {
					reused: "inline",
					target: "draft-2020-12",
				}),
				"urn:arkini:schema:game-config",
				"object",
			],
			[
				GameProjectJsonSchema,
				"urn:arkini:schema:project",
				"union",
			],
		] as const;

		for (const [schema, id, root] of schemas)
			expectNamedJsonSchemaGraph(schema, {
				id,
				dialect: "https://json-schema.org/draft/2020-12/schema",
				root,
			});
		expect(new Set(schemas.map(([schema]) => schema.$id)).size).toBe(schemas.length);
		expect(GameProjectJsonSchema.$defs).toHaveProperty("item.CompositionSchema");
	});

	it.effect("writes the portable game-project JSON Schema", () =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const directory = yield* fileSystem.makeTempDirectoryScoped();
			const output = path.join(directory, "schema.json");

			yield* writeGameProjectJsonSchemaFx({
				output,
			});

			const jsonSchema = yield* fileSystem.readFileString(output);
			const schema = JSON.parse(jsonSchema);

			expect(schema).toMatchObject({
				$id: "urn:arkini:schema:project",
				anyOf: expect.any(Array),
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
						$ref: expect.stringMatching(/^urn:arkini:schema:project#\/\$defs\//),
					},
				},
			});
			expect(jsonSchema.length).toBeLessThan(1_000_000);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
