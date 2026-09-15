import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonEmptyStringSchema } from "~/game-value/schema/NonEmptyStringSchema";
import { ResourceTypeSchema } from "./ResourceTypeSchema";

export const ResourceDescriptorSchema = z
	.object({
		id: IdSchema.describe("The exact resource ID derived from the filename basename."),
		type: ResourceTypeSchema.describe("The semantic type owned by the source directory."),
		path: NonEmptyStringSchema.describe("The source path of this resource."),
	})
	.strict()
	.meta({
		id: "ResourceDescriptorSchema",
		description: "One path-typed source resource descriptor.",
	});

export type ResourceDescriptorSchema = typeof ResourceDescriptorSchema;

export namespace ResourceDescriptorSchema {
	export type Type = z.infer<ResourceDescriptorSchema>;
}
