import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";

/** One or two visual asset layers in authoritative back-to-front order. */
export const CompositionSchema = z
	.union([
		z.tuple([
			IdSchema,
		]),
		z.tuple([
			IdSchema,
			IdSchema,
		]),
	])
	.meta({
		id: "item.CompositionSchema",
		description: "A one- or two-layer visual asset composition in back-to-front order.",
	});

export type CompositionSchema = typeof CompositionSchema;

export namespace CompositionSchema {
	export type Type = z.infer<CompositionSchema>;
}
