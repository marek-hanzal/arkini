import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readItemRemainingChargesFn } from "~/production-action/fn/readItemRemainingChargesFn";
import { ChargeSourceSchema } from "~/production-input/schema/ChargeSourceSchema";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import type { LineRun } from "~/production-line/type/LineRun";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readOutputReservationFn } from "~/production-job/fn/readOutputReservationFn";
import { applyFinalChargeReservationFx } from "./applyFinalChargeReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";
import { readPlannedOutputReservationFx } from "./readPlannedOutputReservationFx";
import { resolveDirectOutputCapacityFx } from "./resolveDirectOutputCapacityFx";
import { resolveOneHopOutputCapacityFx } from "./resolveOneHopOutputCapacityFx";

const readPendingOutputReservationFx = Effect.fn("readPendingOutputReservationFx")(function* ({
	line,
	owner,
}: {
	readonly line: LineSchema.Type;
	readonly owner: RuntimeItemSchema.Type;
}) {
	const quantities = new Map(readOutputReservationFn(line));
	const selfChargeCost = line.input.reduce(
		(total, input) =>
			input.charges?.from === ChargeSourceSchema.enum.Self
				? total + input.charges.cost
				: total,
		0,
	);
	const remainingCharges = readItemRemainingChargesFn(owner);
	if (selfChargeCost <= 0 || remainingCharges !== selfChargeCost) {
		return yield* clampOutputReservationFx(quantities);
	}

	yield* applyFinalChargeReservationFx({
		payer: owner.item,
		quantities,
	});
	return yield* clampOutputReservationFx(quantities);
});

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
