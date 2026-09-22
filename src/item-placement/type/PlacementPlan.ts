import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
/** Exact fresh identities to add together after Board capacity has been validated. */
export interface PlacementPlan {
	readonly spawn: ReadonlyArray<RuntimeItemSchema.Type>;
}
