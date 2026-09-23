import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ResolvedOutcome } from "./ResolvedOutcome";

/** A complete roll retains its origin even when settlement removes the owner. */
export interface ResolvedOutcomeRoll {
	readonly origin: BoardLocationSchema.Type;
	readonly outcome: readonly ResolvedOutcome[];
}
