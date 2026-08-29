import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemLineFn } from "~/engine/line/fn/readItemLineFn";
import type { LineRun } from "~/engine/line/LineRun";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readPendingOutputReservationFx } from "./readPendingOutputReservationFx";
import { readPlannedOutputReservationFx } from "./readPlannedOutputReservationFx";
import { resolveDirectOutputCapacityFx } from "./resolveDirectOutputCapacityFx";
import { resolveOneHopOutputCapacityFx } from "./resolveOneHopOutputCapacityFx";

export namespace resolveStartOutputCapacityFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly plan: LineRun.Plan | undefined;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Block =
		| {
				readonly kind: "direct-output-capacity";
				readonly itemId: IdSchema.Type;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
				readonly excessQuantity: number;
		  }
		| {
				readonly kind: "downstream-output-capacity";
				readonly intermediateItemId: IdSchema.Type;
				readonly itemId: IdSchema.Type;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
				readonly excessQuantity: number;
		  };
}

/** Pure candidate reservation resolver shared by reads and every admission path. */
export const resolveStartOutputCapacityFx = Effect.fn("resolveStartOutputCapacityFx")(function* ({
	lineId,
	ownerItemId,
	plan,
	runtime,
}: resolveStartOutputCapacityFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const line = readItemLineFn({
		item: owner.item,
		lineId,
	});
	if (line === undefined) return undefined;
	const outputReservation =
		plan === undefined
			? yield* readPendingOutputReservationFx({
					line,
					owner,
				})
			: yield* readPlannedOutputReservationFx({
					line,
					plan,
					runtime,
				});
	/*
	 * Prefer the purpose-bound target violation over an intermediate
	 * Blueprint's own cap so the player sees the limit that actually makes
	 * another Blueprint useless.
	 */
	const downstream = yield* resolveOneHopOutputCapacityFx({
		line,
		outputReservation,
		runtime,
	});
	if (downstream !== undefined) {
		return {
			kind: "downstream-output-capacity",
			...downstream,
		} satisfies resolveStartOutputCapacityFx.Block;
	}
	const direct = yield* resolveDirectOutputCapacityFx({
		line,
		outputReservation,
		runtime,
	});
	if (direct === undefined) return undefined;
	return {
		kind: "direct-output-capacity",
		...direct,
	} satisfies resolveStartOutputCapacityFx.Block;
});
