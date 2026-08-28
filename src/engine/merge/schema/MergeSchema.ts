import { z } from "zod";

import { KeepSchema } from "./KeepSchema";
import { RemoveSchema } from "./RemoveSchema";
import { ReplaceSchema } from "./ReplaceSchema";

/**
 * A target-specific directional interaction initiated by dropping its owning
 * item onto another item.
 *
 * Source handling and target effects are separate: `action` describes the
 * source item, while this union's `effect` describes the matched target.
 */
export const MergeSchema = z
	.discriminatedUnion("effect", [
		KeepSchema,
		RemoveSchema,
		ReplaceSchema,
	])
	.meta({
		id: "MergeSchema",
		description: "A discriminated target-specific directional item merge.",
	});

export type MergeSchema = typeof MergeSchema;

export namespace MergeSchema {
	export type Type = z.infer<MergeSchema>;
}
