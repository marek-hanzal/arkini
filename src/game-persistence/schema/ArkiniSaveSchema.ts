import { z } from "zod";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/game-version/schema/ArkpackVersionSchema";

export const ArkiniSaveSchema = z
	.object({
		version: ArkpackVersionSchema,
		arkini: ArkiniVersionSchema,
		state: StateSchema,
	})
	.strict()
	.meta({
		id: "ArkiniSaveSchema",
		description: "An Arkini gameplay save tied to its arkpack and writer versions.",
	});
export type ArkiniSaveSchema = typeof ArkiniSaveSchema;
export namespace ArkiniSaveSchema {
	export type Type = z.infer<ArkiniSaveSchema>;
}
