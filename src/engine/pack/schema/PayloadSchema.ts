import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ResourceSchema } from "./ResourceSchema";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export const PayloadSchema = z
	.object({
		packageId: IdSchema.describe("The stable catalog identity carried by this package."),
		version: ArkpackVersionSchema.describe("The gameplay compatibility version."),
		game: ArkiniVersionSchema.describe("The Arkini version that built this package."),
		config: GameConfigSchema.describe("The decoded completed game configuration."),
		resources: z.array(ResourceSchema).describe("The decoded binary resources."),
	})
	.strict()
	.meta({
		id: "PayloadSchema",
		description: "The decoded configuration and binary resources carried by a game pack.",
	});

export type PayloadSchema = typeof PayloadSchema;

export namespace PayloadSchema {
	export type Type = z.infer<PayloadSchema>;
}
