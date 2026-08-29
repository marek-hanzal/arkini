import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { autofillLineInputsRuntimeFx } from "~/engine/input/write/autofillLineInputsRuntimeFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";

export namespace autofillLineInputsFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}

	export interface Result {
		readonly deliveryItemIds: readonly IdSchema.Type[];
		readonly scheduledQuantity: number;
		readonly remainingMissingQuantity: number;
	}
}

/**
 * Atomically admits whole source stacks into canonical line-input deliveries.
 *
 * One physical source may claim several compatible slots on the same line; its ordered allocations
 * travel together under one runtime identity. Actual input remains unchanged until delivery
 * settlement, so readiness and start commands observe only material that has physically arrived.
 */
export const autofillLineInputsFx = Effect.fn("autofillLineInputsFx")(function* ({
	ownerItemId,
	lineId,
}: autofillLineInputsFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const autofill = yield* autofillLineInputsRuntimeFx({
				ownerItemId,
				lineId,
				runtime,
			});
			return [
				autofill.result,
				autofill.runtime,
				autofill.events,
			] as const;
		}),
	);
});
