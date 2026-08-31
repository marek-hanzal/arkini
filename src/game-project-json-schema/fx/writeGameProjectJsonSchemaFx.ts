import { FileSystem } from "effect";
import { Effect } from "effect";

import { GameProjectJsonSchema } from "~/game-project-json-schema/schema/GameProjectJsonSchema";

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
	yield* fileSystem.writeFileString(
		output,
		`${JSON.stringify(GameProjectJsonSchema, undefined, "\t")}\n`,
	);
});
