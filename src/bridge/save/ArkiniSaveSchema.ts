import { z } from "zod";
import { StateSchema } from "~/engine/state/schema/StateSchema";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export const ArkiniSaveSchema = z
	.object({
		namespace: z.literal("arkini"),
		version: ArkpackVersionSchema,
		game: ArkiniVersionSchema,
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
