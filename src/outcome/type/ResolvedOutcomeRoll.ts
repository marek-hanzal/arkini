import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ResolvedOutcome } from "./ResolvedOutcome";

/** A complete roll retains its defining owner even when settlement removes that identity. */
export interface ResolvedOutcomeRoll {
	readonly ownerItemId: IdSchema.Type;
	readonly origin: BoardLocationSchema.Type;
	readonly outcome: readonly ResolvedOutcome[];
}
