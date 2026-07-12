import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { NonEmptyStringSchema } from "~/v1/common/schema/NonEmptyStringSchema";

export const ResourceDescriptorSchema = z
	.object({
		id: IdSchema.describe("The exact resource ID derived from the filename basename."),
		path: NonEmptyStringSchema.describe("The source path of this resource."),
		mime: z.literal("image/png"),
	})
	.strict()
	.meta({
		id: "ResourceDescriptorSchema",
		description: "One source-aware binary resource descriptor.",
	});

export type ResourceDescriptorSchema = typeof ResourceDescriptorSchema;

export namespace ResourceDescriptorSchema {
	export type Type = z.infer<ResourceDescriptorSchema>;
}
