import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { ResourceTypeSchema } from "./ResourceTypeSchema";

export const ResourceSchema = z
	.object({
		id: IdSchema.describe("The stable resource identifier."),
		type: ResourceTypeSchema.describe("The semantic resource kind."),
		bytes: z
			.custom<Uint8Array>((value) => value instanceof Uint8Array)
			.describe("The raw resource bytes."),
	})
	.strict()
	.meta({
		id: "ResourceSchema",
		description: "One typed binary project resource.",
	});

export type ResourceSchema = typeof ResourceSchema;

export namespace ResourceSchema {
	export type Type = z.infer<ResourceSchema>;
}
