import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { TilePaintingFileSchema } from "./TilePaintingFileSchema";

/** Filesystem identity and freshness surround the source-linked portable recipe. */
export const TilePaintingSchema = TilePaintingFileSchema.extend({
	paintingId: IdSchema,
	projectId: IdSchema,
}).strict();
export type TilePaintingSchema = typeof TilePaintingSchema;
export namespace TilePaintingSchema {
	export type Type = z.infer<TilePaintingSchema>;
}
