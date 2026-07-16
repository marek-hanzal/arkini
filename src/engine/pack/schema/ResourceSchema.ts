import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonEmptyStringSchema } from "~/engine/common/schema/NonEmptyStringSchema";

export const ResourceSchema = z
	.object({
		id: IdSchema.describe("The stable resource identifier."),
		mime: NonEmptyStringSchema.describe("The MIME type of the resource bytes."),
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
