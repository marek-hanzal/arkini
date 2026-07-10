import { z } from "zod";

import { MergeConsumeSchema } from "./MergeConsumeSchema";
import { MergeKeepSchema } from "./MergeKeepSchema";
import { MergeUseSchema } from "./MergeUseSchema";

/**
 * A target-specific directional interaction initiated by dropping its owning
 * item onto another item.
 *
 * Each action has its own schema, so source handling and whether a result is
 * allowed or required are explicit and safe to exhaustively match at runtime.
 */
export const MergeSchema = z
	.discriminatedUnion("action", [
		MergeKeepSchema,
		MergeUseSchema,
		MergeConsumeSchema,
	])
	.meta({
		id: "MergeSchema",
		description: "A discriminated target-specific directional item merge.",
	});

export type MergeSchema = typeof MergeSchema;

export namespace MergeSchema {
	export type Type = z.infer<MergeSchema>;
}
