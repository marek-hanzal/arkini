import { z } from "zod";

/** Semantic resource kinds currently admitted by portable projects and Arkpacks. */
export const ResourceTypeSchema = z.enum([
	"artwork",
	"image",
	"music",
]);

export type ResourceTypeSchema = typeof ResourceTypeSchema;

export namespace ResourceTypeSchema {
	export type Type = z.infer<ResourceTypeSchema>;
}
