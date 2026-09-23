import { Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { narrowDeliveryRuntimeItemFn } from "~/game-runtime/fn/narrowDeliveryRuntimeItemFn";
import type { DeliveryRuntimeItemSchema } from "~/game-runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface LineInputDeliveryClaim {
	readonly delivery: DeliveryRuntimeItemSchema.Type;
	readonly inputIndex: number;
}

/** Reads ordered outbound soft claims for one exact line or material-input slot. */
export const readLineInputDeliveryClaimsFn = ({
	inputIndex,
	lineUid,
	ownerItemId,
	runtime,
}: {
	readonly inputIndex?: number;
	readonly lineUid: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const claims: LineInputDeliveryClaim[] = [];
	for (const item of runtime.items) {
		const delivery = narrowDeliveryRuntimeItemFn(item);
		if (
			Option.isNone(delivery) ||
			delivery.value.location.phase !== "outbound" ||
			delivery.value.location.target.ownerItemId !== ownerItemId ||
			delivery.value.location.target.lineUid !== lineUid
		) {
			continue;
		}
		const target = delivery.value.location.target;
		if (inputIndex !== undefined && target.inputIndex !== inputIndex) continue;
		claims.push({
			delivery: delivery.value,
			inputIndex: target.inputIndex,
		});
	}
	return claims;
};
