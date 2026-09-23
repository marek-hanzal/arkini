import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readLineInputDeliveryClaimsFn } from "~/production-delivery/fn/readLineInputDeliveryClaimsFn";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import { readLineInputAutofillSourcesFn } from "~/production-input/fn/readLineInputAutofillSourcesFn";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";

export namespace planLineInputAutofillFx {
	export interface Props {
		readonly includeIncomingDeliveries?: boolean;
		/** Omission plans the whole line; a target allocates only this material slot. */
		readonly inputIndex?: number;
		readonly ownerItemId: IdSchema.Type;
		readonly lineUid: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Entry {
		readonly inputIndex: number;
		readonly sourceItemId: IdSchema.Type;
	}

	export interface Result {
		readonly entry: readonly Entry[];
		readonly remainingMissingQuantity: number;
	}
}

const compareCandidatesFn = (owner: BoardRuntimeItemSchema.Type) => {
	return (left: BoardRuntimeItemSchema.Type, right: BoardRuntimeItemSchema.Type) => {
		return (
			Math.abs(left.location.position.x - owner.location.position.x) +
				Math.abs(left.location.position.y - owner.location.position.y) -
				(Math.abs(right.location.position.x - owner.location.position.x) +
					Math.abs(right.location.position.y - owner.location.position.y)) ||
			left.location.position.y - right.location.position.y ||
			left.location.position.x - right.location.position.x ||
			left.id.localeCompare(right.id)
		);
	};
};

/**
 * Plans deterministic automatic material delivery for one exact line.
 *
 * Each input applies its query. Sources in the owner's Board space sort by distance and stable slot order.
 * Required minima are allocated across every slot before compatible range inputs receive optional
 * top-ups toward their maximum. The planner does not mutate runtime truth itself.
 */
export const planLineInputAutofillFx = Effect.fn("planLineInputAutofillFx")(function* ({
	includeIncomingDeliveries = true,
	inputIndex: targetInputIndex,
	ownerItemId,
	lineUid,
	runtime,
}: planLineInputAutofillFx.Props) {
	const { line, owner } = yield* readBoardItemLineFx({
		ownerItemId,
		lineUid,
		runtime,
	});
	const candidatesById = new Map<string, BoardRuntimeItemSchema.Type>();
	const entries: planLineInputAutofillFx.Entry[] = [];
	const slots: {
		readonly closed: boolean;
		readonly input: MaterialSchema.Type;
		readonly inputIndex: number;
		readonly matchingRuntimeItemIds: ReadonlySet<IdSchema.Type>;
		readonly maxQuantity: number;
		readonly minQuantity: number;
		plannedQuantity: number;
	}[] = [];

	for (const [inputIndex, input] of line.input.entries()) {
		if (targetInputIndex !== undefined && inputIndex !== targetInputIndex) continue;
		if (input.type !== TypeSchema.enum.Materials) continue;

		const storedItems = runtime.items.filter(
			(item) =>
				item.location.scope === LocationScopeEnumSchema.enum.Input &&
				item.location.ownerItemId === ownerItemId &&
				item.location.lineUid === lineUid &&
				item.location.inputIndex === inputIndex,
		);
		const storedQuantity = storedItems.length;
		const incomingQuantity = includeIncomingDeliveries
			? readLineInputDeliveryClaimsFn({
					inputIndex,
					lineUid,
					ownerItemId,
					runtime,
				}).length
			: 0;
		let plannedQuantity = storedQuantity + incomingQuantity;
		const initialResolution = resolveInputMaterialFn({
			input,
			storedQuantity: plannedQuantity,
		});
		const closed = isLineInputClosedFn({
			ownerItemId,
			lineUid,
			runtime,
		});
		const matchingItems = readLineInputAutofillSourcesFn({
			owner,
			runtime,
			query: input.query,
		});
		for (const candidate of matchingItems) candidatesById.set(candidate.id, candidate);

		slots.push({
			closed,
			input,
			inputIndex,
			matchingRuntimeItemIds: new Set(matchingItems.map((item) => item.id)),
			maxQuantity: initialResolution.required.max,
			minQuantity: initialResolution.required.min,
			plannedQuantity,
		});
	}

	const candidates = [
		...candidatesById.values(),
	].sort(compareCandidatesFn(owner));
	const allocatedItemIds = new Set<IdSchema.Type>();
	const allocateToFn = (slot: (typeof slots)[number], targetQuantity: number) => {
		for (const candidate of candidates) {
			if (slot.plannedQuantity >= targetQuantity) break;
			if (
				allocatedItemIds.has(candidate.id) ||
				!slot.matchingRuntimeItemIds.has(candidate.id)
			)
				continue;
			entries.push({
				inputIndex: slot.inputIndex,
				sourceItemId: candidate.id,
			});
			allocatedItemIds.add(candidate.id);
			slot.plannedQuantity += 1;
		}
	};

	// Exact selectors and query reaches form nested or disjoint source sets for one owner.
	// Fill narrower sets first so a broad input cannot strand an otherwise satisfiable minimum.
	const requiredSlots = [
		...slots,
	].sort((left, right) => left.matchingRuntimeItemIds.size - right.matchingRuntimeItemIds.size);
	for (const slot of requiredSlots) {
		if (!slot.closed) allocateToFn(slot, slot.minQuantity);
	}
	const remainingMissingQuantity = slots.reduce(
		(total, slot) => total + Math.max(0, slot.minQuantity - slot.plannedQuantity),
		0,
	);
	// Only material still unclaimed after every minimum may optimize range inputs toward max.
	for (const slot of slots) {
		if (!slot.closed && slot.maxQuantity > slot.minQuantity) {
			allocateToFn(slot, slot.maxQuantity);
		}
	}

	return {
		entry: entries,
		remainingMissingQuantity,
	} satisfies planLineInputAutofillFx.Result;
});
