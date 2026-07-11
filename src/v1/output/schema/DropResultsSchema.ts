import { z } from "zod";

import { DropResultSchema } from "./DropResultSchema";

/**
 * The intentionally empty or single resolved result of one drop evaluation.
 *
 * One configured drop can either be rejected by its rules or resolve to exactly
 * one concrete item drop. It never expands into an arbitrary number of results.
 */
export const DropResultsSchema = z
	.union([
		z.tuple([]),
		z.tuple([
			DropResultSchema,
		]),
	])
	.meta({
		id: "DropResultsSchema",
		description: "The empty or single resolved result of one drop evaluation.",
	});

export type DropResultsSchema = typeof DropResultsSchema;

export namespace DropResultsSchema {
	export type Type = z.infer<DropResultsSchema>;
}
