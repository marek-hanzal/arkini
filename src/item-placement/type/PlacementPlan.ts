import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";

/** Exact fresh identities to add together after Board capacity has been validated. */
export interface PlacementPlan {
	readonly spawn: ReadonlyArray<BoardRuntimeItemSchema.Type>;
}
