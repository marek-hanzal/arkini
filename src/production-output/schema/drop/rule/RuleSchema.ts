import { z } from "zod";

import { DisableSchema } from "./DisableSchema";
import { EnableSchema } from "./EnableSchema";

/**
 * An availability rule evaluated for a drop selected by a successful roll.
 *
 * Each member owns its own behavior and fields. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const RuleSchema = z
	.discriminatedUnion("type", [
		EnableSchema,
		DisableSchema,
	])
	.meta({
		id: "drop.RuleSchema",
		description: "An availability rule evaluated for a selected drop.",
	});

export type RuleSchema = typeof RuleSchema;

export namespace RuleSchema {
	export type Type = z.infer<RuleSchema>;
}
