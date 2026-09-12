import type { z } from "zod";
import { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";

/** Omitted bytes preserve the existing disk content during an asset rename. */
export const ProjectResourceReplacementSchema = ResourceSchema.partial({
	bytes: true,
}).meta({
	id: "ProjectResourceReplacementSchema",
	description: "An asset rename with optional replacement PNG content.",
});
export type ProjectResourceReplacementSchema = typeof ProjectResourceReplacementSchema;
export namespace ProjectResourceReplacementSchema {
	export type Type = z.infer<ProjectResourceReplacementSchema>;
}
