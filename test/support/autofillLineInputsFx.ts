import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { autofillLineInputsRuntimeFx } from "~/production-input/fx/autofillLineInputsRuntimeFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export namespace autofillLineInputsFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineUid: IdSchema.Type;
	}

	export interface Result {
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
	lineUid,
}: autofillLineInputsFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const autofill = yield* autofillLineInputsRuntimeFx({
				ownerItemId,
				lineUid,
				runtime,
			});
			return [
				autofill.result,
				autofill.runtime,
				autofill.facts,
			] as const;
		}),
	);
});
