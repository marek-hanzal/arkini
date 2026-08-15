import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads the concrete remaining charge pool of one canonical item across all live stacks. */
export const readPlannerRuntimeChargeCapacityFx = Effect.fn("readPlannerRuntimeChargeCapacityFx")(
	(runtime: RuntimeSchema.Type, itemId: IdSchema.Type) =>
		Effect.sync(() =>
			runtime.items.reduce((total, item) => {
				if (item.item.id !== itemId) return total;
				const fullCapacity = item.item.charges?.amount;
				if (fullCapacity === undefined) return total;
				return total + (item.remainingCharges ?? fullCapacity) * item.quantity;
			}, 0),
		),
);
