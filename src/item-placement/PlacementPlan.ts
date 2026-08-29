import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Every internal runtime mutation required to place one resolved drop atomically. */
export interface PlacementPlan {
	readonly remove: ReadonlyArray<IdSchema.Type>;
	readonly stack: ReadonlyArray<{
		readonly itemId: IdSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
	}>;
	readonly spawn: ReadonlyArray<{
		readonly item: RuntimeItemSchema.Type;
	}>;
}
