import { z } from "zod";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

/** Arkini application version sourced from the root package manifest. */
export const ArkiniVersionSchema = z.literal(ArkiniAppVersion).meta({
	id: "ArkiniVersionSchema",
	description: "The exact Arkini application version accepted by this build.",
});

export type ArkiniVersionSchema = typeof ArkiniVersionSchema;

export namespace ArkiniVersionSchema {
	export type Type = z.infer<ArkiniVersionSchema>;
}
