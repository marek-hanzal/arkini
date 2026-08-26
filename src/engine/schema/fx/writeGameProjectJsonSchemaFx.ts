import { FileSystem } from "effect";
import { Effect } from "effect";
import { z } from "zod";

import { GameProjectSourceSchema } from "~/engine/source/schema/GameProjectSourceSchema";

const qualifyRootReferences = (schema: Record<string, unknown>) => {
	const rootId = schema.$id;
	if (typeof rootId !== "string")
		throw new Error("The exported JSON Schema requires a root $id.");

	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}
		if (typeof value !== "object" || value === null) return;
		const record = value as Record<string, unknown>;
		if (typeof record.$ref === "string" && record.$ref.startsWith("#/$defs/"))
			record.$ref = `${rootId}${record.$ref}`;
		for (const child of Object.values(record)) visit(child);
	};
	visit(schema);
	return schema;
};

export const createGameProjectJsonSchema = () =>
	qualifyRootReferences(
		z.toJSONSchema(GameProjectSourceSchema, {
			reused: "inline",
			target: "draft-2020-12",
		}),
	);

export namespace writeGameProjectJsonSchemaFx {
	export interface Props {
		/** Destination where the generated project JSON Schema is written. */
		output: string;
	}
}

/** Generates the schema shared by project root and item authoring files. */
export const writeGameProjectJsonSchemaFx = Effect.fn("writeGameProjectJsonSchemaFx")(function* ({
	output,
}: writeGameProjectJsonSchemaFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const jsonSchema = createGameProjectJsonSchema();
	yield* fileSystem.writeFileString(output, `${JSON.stringify(jsonSchema, undefined, "\t")}\n`);
});
