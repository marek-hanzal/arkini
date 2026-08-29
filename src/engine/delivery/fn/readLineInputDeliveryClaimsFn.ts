import { Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { isDeliveryRuntimeItemFn } from "~/engine/runtime/read/fn/isDeliveryRuntimeItemFn";
import type { DeliveryRuntimeItemSchema } from "~/engine/runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface LineInputDeliveryClaim {
	readonly delivery: DeliveryRuntimeItemSchema.Type;
	readonly inputIndex: number;
	readonly quantity: number;
}

/** Reads ordered outbound soft claims for one exact line or material-input slot. */
export const readLineInputDeliveryClaimsFn = ({
	inputIndex,
	lineId,
	ownerItemId,
	runtime,
}: {
	readonly inputIndex?: number;
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const claims: LineInputDeliveryClaim[] = [];
	for (const item of runtime.items) {
		const delivery = isDeliveryRuntimeItemFn(item);
		if (
			Option.isNone(delivery) ||
			delivery.value.location.phase !== "outbound" ||
			delivery.value.location.target.ownerItemId !== ownerItemId ||
			delivery.value.location.target.lineId !== lineId
		) {
			continue;
		}
		for (const allocation of delivery.value.location.target.input) {
			if (inputIndex !== undefined && allocation.inputIndex !== inputIndex) continue;
			claims.push({
				delivery: delivery.value,
				inputIndex: allocation.inputIndex,
				quantity: allocation.quantity,
			});
		}
	}
	return claims;
};
