import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Every internal runtime mutation required to place one resolved drop atomically. */
export interface PlacementPlan {
	readonly remove: ReadonlyArray<IdSchema.Type>;
	readonly spawn: ReadonlyArray<{
		readonly item: RuntimeItemSchema.Type;
	}>;
}
