import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";

/** Canonical discovery budgets and snapshot pins; each focused schema selects its applicable controls. */
export const GraphDiscoveryBoundsSchema = z
	.object({
		limit: z.number().int().min(1).max(200).default(50),
		maxExpansions: z.number().int().min(1).max(100000).default(10000),
		timeoutMs: z.number().int().min(1).max(5000).default(1000),
		revision: z.number().int().nonnegative().optional(),
		snapshotId: IdSchema.optional(),
	})
	.strict();
export type GraphDiscoveryBoundsSchema = typeof GraphDiscoveryBoundsSchema;
export namespace GraphDiscoveryBoundsSchema {
	export type Type = z.infer<GraphDiscoveryBoundsSchema>;
}
