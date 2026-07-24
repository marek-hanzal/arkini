import { FileSystem } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";

export namespace writeGameJsonSchemaFx {
	export interface Props {
		/**
		 * Destination where the generated JSON Schema is written.
		 */
		output: string;
	}
}

/**
 * Generates and writes the current game configuration JSON Schema for authoring tools.
 */
export const writeGameJsonSchemaFx = Effect.fn("writeGameJsonSchemaFx")(function* ({
	output,
}: writeGameJsonSchemaFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const jsonSchema = z.toJSONSchema(GameSourceSchema, {
		reused: "inline",
		target: "draft-2020-12",
	});

	yield* fileSystem.writeFileString(output, `${JSON.stringify(jsonSchema, undefined, "\t")}\n`);
});
