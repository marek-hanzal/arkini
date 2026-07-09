import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { z } from "zod";
import { GameSchema } from "~/v1/schema/GameSchema";

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
export const writeGameJsonSchemaFx = ({ output }: writeGameJsonSchemaFx.Props) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		const jsonSchema = z.toJSONSchema(GameSchema, {
			reused: "inline",
			target: "draft-2020-12",
		});

		yield* fileSystem.writeFileString(
			output,
			`${JSON.stringify(jsonSchema, undefined, "\t")}\n`,
		);
	});
