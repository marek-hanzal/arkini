import { z } from "zod";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export const SerakkiSaveSchema = z
	.object({
		version: GameVersionSchema,
		serakki: SerakkiVersionSchema,
		state: StateSchema,
	})
	.strict()
	.meta({
		id: "SerakkiSaveSchema",
		description: "An Serakki gameplay save tied to its serapack and writer versions.",
	});
export type SerakkiSaveSchema = typeof SerakkiSaveSchema;
export namespace SerakkiSaveSchema {
	export type Type = z.infer<SerakkiSaveSchema>;
}
