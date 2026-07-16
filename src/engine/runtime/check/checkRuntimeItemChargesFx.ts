import { Effect } from "effect";

import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { ItemChargesIssueSchema } from "~/engine/runtime/schema/check/ItemChargesIssueSchema";

export namespace checkRuntimeItemChargesFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reports every non-canonical live item charge state. */
export const checkRuntimeItemChargesFx = Effect.fn("checkRuntimeItemChargesFx")(function* ({
	runtime,
}: checkRuntimeItemChargesFx.Props) {
	const issues: ItemChargesIssueSchema.Type[] = [];

	for (const item of runtime.items) {
		if (item.remainingCharges === undefined) continue;
		const amount = item.item.charges?.amount;
		if (amount === undefined) {
			issues.push({
				type: "item:charges",
				itemId: item.id,
				remainingCharges: item.remainingCharges,
				reason: "missing-config",
			});
			continue;
		}
		if (item.remainingCharges > amount) {
			issues.push({
				type: "item:charges",
				itemId: item.id,
				amount,
				remainingCharges: item.remainingCharges,
				reason: "exceeds-amount",
			});
			continue;
		}
		if (item.remainingCharges === amount) {
			issues.push({
				type: "item:charges",
				itemId: item.id,
				amount,
				remainingCharges: item.remainingCharges,
				reason: "full-state",
			});
			continue;
		}
		if (
			item.remainingCharges === 0 &&
			!runtime.jobs.some((job) => job.ownerItemId === item.id)
		) {
			issues.push({
				type: "item:charges",
				itemId: item.id,
				amount,
				remainingCharges: item.remainingCharges,
				reason: "depleted-idle",
			});
		}
	}

	return issues;
});
