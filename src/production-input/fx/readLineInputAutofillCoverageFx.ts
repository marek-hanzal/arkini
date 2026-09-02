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
		readonly selectedQuantity: number;
	}

	export type Result =
		| (Coverage & {
				readonly type: "complete";
		  })
		| (Coverage & {
				readonly type: "incomplete";
				readonly missingQuantity: number;
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
		const selectedQuantity = plan.entry.reduce((total, entry) => {
			return total + entry.quantity;
		}, 0);
		if (plan.remainingMissingQuantity > 0) {
			return {
				type: "incomplete",
				missingQuantity: plan.remainingMissingQuantity,
				plan,
				selectedQuantity,
			} satisfies readLineInputAutofillCoverageFx.Result;
		}
		return {
			type: "complete",
			plan,
			selectedQuantity,
		} satisfies readLineInputAutofillCoverageFx.Result;
	},
);
