import { z } from "zod";
import { StateSchema } from "~/engine/state/schema/StateSchema";

export const ArkiniSaveSchema = z
	.object({
		namespace: z.literal("arkini"),
		format: z.literal(1),
		state: StateSchema,
	})
	.strict()
	.meta({
		id: "ArkiniSaveSchema",
		description: "The minimal versioned Arkini gameplay save envelope.",
	});
export type ArkiniSaveSchema = typeof ArkiniSaveSchema;
export namespace ArkiniSaveSchema {
	export type Type = z.infer<ArkiniSaveSchema>;
}
