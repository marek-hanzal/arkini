import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ChargeSourceSchema } from "~/production-input/schema/ChargeSourceSchema";
import { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readOutputConditionalMaximumQuantitiesFn } from "~/production-output/fn/readOutputConditionalMaximumQuantitiesFn";
import { readOutputMaximumQuantitiesFn } from "~/production-output/fn/readOutputMaximumQuantitiesFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readOutputReservationFn } from "~/production-job/fn/readOutputReservationFn";
import { applyFinalChargeReservationFx } from "./applyFinalChargeReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";
import type { resolveOutputCapacityFx } from "./resolveOutputCapacityFx";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
import { resolveDirectOutputCapacityFx } from "./resolveDirectOutputCapacityFx";

const readDefinitionOutputReservationFx = Effect.fn("readDefinitionOutputReservationFx")(
	function* ({
		line,
		owner,
	}: {
		readonly line: LineSchema.Type;
		readonly owner: ItemSchema.Type;
	}) {
		const quantities = new Map(readOutputReservationFn(line));
		const selfChargeCost = line.input.reduce(
			(total, input) =>
				input.charges?.from === ChargeSourceSchema.enum.Self
					? total + input.charges.cost
					: total,
			0,
		);
		if (selfChargeCost <= 0 || owner.charges?.amount !== selfChargeCost) {
			return yield* clampOutputReservationFx(quantities);
		}
		yield* applyFinalChargeReservationFx({
			payer: owner,
			quantities,
		});
		return yield* clampOutputReservationFx(quantities);
	},
);

interface OneHopOutputCapacityBlock extends resolveOutputCapacityFx.Block {
	readonly intermediateItemId: IdSchema.Type;
}

export namespace resolveOneHopOutputCapacityFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly outputReservation?: ReadonlyMap<IdSchema.Type, number>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Checks exactly one blueprint intermediate hop.
 *
 * Blueprint is the authored purpose-bound intermediate contract. Ordinary
 * materials and other multi-purpose line owners are deliberately not traversed.
 */
export const resolveOneHopOutputCapacityFx = Effect.fn("resolveOneHopOutputCapacityFx")(function* ({
	line,
	outputReservation,
	runtime,
}: resolveOneHopOutputCapacityFx.Props) {
	if (line.output === undefined) return undefined;
	const produced = readOutputMaximumQuantitiesFn({
		output: line.output,
	});
	const activeReservations = readReservedJobOutputQuantitiesFn({
		runtime,
	});
	const reservationAdjustments = new Map<IdSchema.Type, number>();
	if (outputReservation !== undefined) {
		for (const itemId of new Set([
			...produced.keys(),
			...outputReservation.keys(),
		])) {
			const adjustment = (outputReservation.get(itemId) ?? 0) - (produced.get(itemId) ?? 0);
			if (adjustment !== 0) reservationAdjustments.set(itemId, adjustment);
		}
	}

	for (const intermediateItemId of [
		...produced.keys(),
	].sort()) {
		const intermediate = yield* resolveItemFx({
			itemId: intermediateItemId,
		});
		if (intermediate.type !== TypeSchema.enum.Blueprint) continue;
		const owner = Option.getOrUndefined(isLineOwnerItemFn(intermediate));
		if (owner === undefined) continue;
		const applicable = readLineOwnerLinesFn(owner).filter(
			(candidate) => candidate.show && candidate.enable,
		);
		if (applicable.length === 0) continue;
		const branchReserved = readOutputConditionalMaximumQuantitiesFn({
			output: line.output,
			requiredItemId: intermediateItemId,
		});
		if (branchReserved === undefined) continue;
		for (const [itemId, adjustment] of reservationAdjustments) {
			const quantity = (branchReserved.get(itemId) ?? 0) + adjustment;
			if (quantity <= 0) branchReserved.delete(itemId);
			else branchReserved.set(itemId, quantity);
		}
		/*
		 * Every idle Blueprint and every pending Blueprint output is one future
		 * execution of its purpose-bound line. Active Blueprint owners are
		 * represented by their job output reservation instead of being counted
		 * twice as both a live Blueprint and a future target.
		 */
		const activeJobCountByBlueprintOwnerId = new Map<IdSchema.Type, number>();
		for (const job of runtime.jobs) {
			const jobOwner = runtime.items.find((item) => item.id === job.ownerItemId);
			if (jobOwner?.item.id !== intermediateItemId) continue;
			activeJobCountByBlueprintOwnerId.set(
				job.ownerItemId,
				(activeJobCountByBlueprintOwnerId.get(job.ownerItemId) ?? 0) + 1,
			);
		}
		const liveIdleQuantity = runtime.items.reduce(
			(quantity, candidate) =>
				candidate.item.id === intermediateItemId
					? quantity +
						Math.max(
							0,
							candidate.quantity -
								(activeJobCountByBlueprintOwnerId.get(candidate.id) ?? 0),
						)
					: quantity,
			0,
		);
		const committedIntermediateQuantity =
			liveIdleQuantity +
			(activeReservations.get(intermediateItemId)?.quantity ?? 0) +
			(branchReserved.get(intermediateItemId) ?? 0);
		if (committedIntermediateQuantity <= 0) continue;

		let firstBlock: resolveOutputCapacityFx.Block | undefined;
		let everyApplicableLineBlocked = true;
		for (const candidate of applicable) {
			const outputReservation = yield* readDefinitionOutputReservationFx({
				line: candidate,
				owner: intermediate,
			});
			const committedReservation = new Map(
				[
					...outputReservation,
				].map(([itemId, quantity]) => [
					itemId,
					quantity * committedIntermediateQuantity,
				]),
			);
			const block = yield* resolveDirectOutputCapacityFx({
				additionalReserved: branchReserved,
				excludedItemIds: new Set([
					intermediateItemId,
				]),
				line: candidate,
				outputReservation: committedReservation,
				runtime,
			});
			if (block === undefined) {
				everyApplicableLineBlocked = false;
				break;
			}
			firstBlock ??= block;
		}
		if (everyApplicableLineBlocked && firstBlock !== undefined) {
			return {
				...firstBlock,
				intermediateItemId,
			} satisfies OneHopOutputCapacityBlock;
		}
	}
	return undefined;
});
