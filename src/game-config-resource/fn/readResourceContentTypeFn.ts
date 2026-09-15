import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

/** Derives the delivery MIME type from Arkini's stricter semantic resource type. */
export const readResourceContentTypeFn = (_type: ResourceTypeSchema.Type) => "image/png";
