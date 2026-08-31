import { z } from "zod";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export const ArkiniSaveSchema = z
	.object({
		version: GameVersionSchema,
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
