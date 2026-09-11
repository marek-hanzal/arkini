import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { TilePaintingDocumentSchema } from "./TilePaintingDocumentSchema";

/** Portable recipe payload; filename and containing root own painting/project identity. */
export const TilePaintingFileSchema = z
	.object({
		updatedAtMs: z.number().int().nonnegative(),
		outputResourceId: IdSchema.nullable(),
		document: TilePaintingDocumentSchema,
	})
	.strict();
export type TilePaintingFileSchema = typeof TilePaintingFileSchema;
export namespace TilePaintingFileSchema {
	export type Type = z.infer<TilePaintingFileSchema>;
}
