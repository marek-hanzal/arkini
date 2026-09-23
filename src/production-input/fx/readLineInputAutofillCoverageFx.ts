import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { planLineInputAutofillFx } from "~/production-input/fx/planLineInputAutofillFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readLineInputAutofillCoverageFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	interface Coverage {
		readonly plan: planLineInputAutofillFx.Result;
	}

	export type Result =
		| (Coverage & {
				readonly type: "complete";
		  })
		| (Coverage & {
				readonly type: "incomplete";
		  });
}

/**
 * Resolves whether exact current grid sources can complete one line's missing material inputs.
 *
 * In-flight deliveries are intentionally excluded. They are concrete runtime items, but they are
 * not physically available to queued start admission until their canonical settlement.
 */
export const readLineInputAutofillCoverageFx = Effect.fn("readLineInputAutofillCoverageFx")(
	function* ({ lineId, ownerItemId, runtime }: readLineInputAutofillCoverageFx.Props) {
		const plan = yield* planLineInputAutofillFx({
			includeIncomingDeliveries: false,
			lineId,
			ownerItemId,
			runtime,
		});
		if (plan.remainingMissingQuantity > 0) {
			return {
				type: "incomplete",
				plan,
			} satisfies readLineInputAutofillCoverageFx.Result;
		}
		return {
			type: "complete",
			plan,
		} satisfies readLineInputAutofillCoverageFx.Result;
	},
);
