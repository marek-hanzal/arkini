import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";

export const ResourceSchema = z
	.object({
		id: IdSchema.describe("The stable resource identifier."),
		mime: z.literal("image/png").describe("The fixed MIME type of Arkini resources."),
		bytes: z
			.custom<Uint8Array>((value) => value instanceof Uint8Array)
			.describe("The raw resource bytes."),
	})
	.strict()
	.meta({
		id: "ResourceSchema",
		description: "One binary resource embedded in a game pack.",
	});

export type ResourceSchema = typeof ResourceSchema;

export namespace ResourceSchema {
	export type Type = z.infer<ResourceSchema>;
}
