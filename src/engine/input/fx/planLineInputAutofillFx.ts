import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readLineInputDeliveryClaimsFx } from "~/engine/delivery/read/readLineInputDeliveryClaimsFx";
import { resolveInputMaterialFx } from "~/engine/input/fx/resolveInputMaterialFx";
import { isLineInputAutofillSourceLocationFx } from "~/engine/input/read/isLineInputAutofillSourceLocationFx";
import { readMaterialInputEligibilityFx } from "~/engine/input/read/readMaterialInputEligibilityFx";
import type { MaterialSchema } from "~/engine/input/schema/MaterialSchema";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { selectItemsFx } from "~/engine/selector/fx/selectItemsFx";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";

export namespace planLineInputAutofillFx {
	export interface Props {
		readonly includeIncomingDeliveries?: boolean;
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Entry {
		readonly inputIndex: number;
		readonly sourceItemId: IdSchema.Type;
		readonly quantity: number;
	}

	export interface Result {
		readonly entry: readonly Entry[];
		readonly storedQuantity: number;
		readonly remainingMissingQuantity: number;
	}
}

const candidateRank = ({
	candidate,
	owner,
}: {
	readonly candidate: GridRuntimeItemSchema.Type;
	readonly owner: BoardRuntimeItemSchema.Type;
}) => {
	return {
		scope:
			candidate.location.scope === LocationScopeEnumSchema.enum.Board
				? 0
				: candidate.location.scope === LocationScopeEnumSchema.enum.Toolbar
					? 1
					: 2,
		distance:
			candidate.location.scope === LocationScopeEnumSchema.enum.Board
				? Math.abs(candidate.location.position.x - owner.location.position.x) +
					Math.abs(candidate.location.position.y - owner.location.position.y)
				: 0,
		position: candidate.location.position.y * 10_000 + candidate.location.position.x,
	};
};

const compareCandidates = (owner: BoardRuntimeItemSchema.Type) => {
	return (left: GridRuntimeItemSchema.Type, right: GridRuntimeItemSchema.Type) => {
		const leftRank = candidateRank({
			candidate: left,
			owner,
		});
		const rightRank = candidateRank({
			candidate: right,
			owner,
		});

		return (
			leftRank.scope - rightRank.scope ||
			leftRank.distance - rightRank.distance ||
			leftRank.position - rightRank.position ||
			left.id.localeCompare(right.id)
		);
	};
};

/**
 * Plans deterministic automatic material delivery for one exact line.
 *
 * Sources prefer the owner's board space by distance, then Toolbar and Inventory slot order.
 * Required minima are allocated across every slot before compatible range inputs receive optional
 * top-ups toward their maximum. The planner never consumes authored buffer capacity or mutates
 * runtime truth itself.
 */
export const planLineInputAutofillFx = Effect.fn("planLineInputAutofillFx")(function* ({
	includeIncomingDeliveries = true,
	ownerItemId,
	lineId,
	runtime,
}: planLineInputAutofillFx.Props) {
	const { line, owner } = yield* readBoardItemLineFx({
		ownerItemId,
		lineId,
		runtime,
	});
	const activeJobOwnerItemIds = new Set(runtime.jobs.map((job) => job.ownerItemId));

	const candidates: GridRuntimeItemSchema.Type[] = [];
	for (const candidate of runtime.items) {
		const gridCandidate = Option.getOrUndefined(isGridRuntimeItemFn(candidate));
		if (
			gridCandidate === undefined ||
			gridCandidate.id === owner.id ||
			activeJobOwnerItemIds.has(gridCandidate.id) ||
			!(yield* isLineInputAutofillSourceLocationFx({
				location: gridCandidate.location,
				ownerSpace: owner.location.space,
			}))
		) {
			continue;
		}
		candidates.push(gridCandidate);
	}
	candidates.sort(compareCandidates(owner));
	const eligibleCandidateItems = (yield* readMaterialInputEligibilityFx({
		items: candidates.map((candidate) => candidate.item),
	})).eligibleItems;
	const remainingByItemId = new Map(
		candidates.map((candidate) => [
			candidate.id,
			candidate.quantity,
		]),
	);
	const entries: planLineInputAutofillFx.Entry[] = [];
	const entryIndexByKey = new Map<string, number>();
	const slots: {
		readonly closed: boolean;
		readonly input: MaterialSchema.Type;
		readonly inputIndex: number;
		readonly matchingCanonicalItemIds: ReadonlySet<IdSchema.Type>;
		readonly maxQuantity: number;
		readonly minQuantity: number;
		plannedQuantity: number;
	}[] = [];

	for (const [inputIndex, input] of line.input.entries()) {
		if (input.type !== TypeSchema.enum.Materials) continue;

		const storedItems = runtime.items.filter(
			(item) =>
				item.location.scope === LocationScopeEnumSchema.enum.Input &&
				item.location.ownerItemId === ownerItemId &&
				item.location.lineId === lineId &&
				item.location.inputIndex === inputIndex,
		);
		const storedQuantity = storedItems.reduce((total, item) => total + item.quantity, 0);
		const incomingQuantity = includeIncomingDeliveries
			? (yield* readLineInputDeliveryClaimsFx({
					inputIndex,
					lineId,
					ownerItemId,
					runtime,
				})).reduce((total, claim) => total + claim.quantity, 0)
			: 0;
		let plannedQuantity = storedQuantity + incomingQuantity;
		const initialResolution = yield* resolveInputMaterialFx({
			input,
			storedQuantity: plannedQuantity,
		});
		const closed = yield* isLineInputClosedFx({
			input,
			ownerItemId,
			lineId,
			runtime,
		});
		const matchingItems = yield* selectItemsFx({
			items: eligibleCandidateItems,
			selector: input.selector,
		});
		slots.push({
			closed,
			input,
			inputIndex,
			matchingCanonicalItemIds: new Set(matchingItems.map((item) => item.id)),
			maxQuantity: initialResolution.required.max,
			minQuantity: initialResolution.required.min,
			plannedQuantity,
		});
	}

	const allocateTo = (slot: (typeof slots)[number], targetQuantity: number) => {
		let requestedQuantity = Math.max(0, targetQuantity - slot.plannedQuantity);
		for (const candidate of candidates) {
			if (requestedQuantity === 0) break;
			const remainingQuantity = remainingByItemId.get(candidate.id) ?? 0;
			if (remainingQuantity === 0) continue;

			if (!slot.matchingCanonicalItemIds.has(candidate.item.id)) continue;
			const quantity = Math.min(remainingQuantity, requestedQuantity);
			if (quantity === 0) continue;

			const entryKey = `${candidate.id}\u0000${slot.inputIndex}`;
			const existingEntryIndex = entryIndexByKey.get(entryKey);
			if (existingEntryIndex === undefined) {
				entryIndexByKey.set(entryKey, entries.length);
				entries.push({
					inputIndex: slot.inputIndex,
					sourceItemId: candidate.id,
					quantity,
				});
			} else {
				const existingEntry = entries[existingEntryIndex];
				if (existingEntry !== undefined) {
					entries[existingEntryIndex] = {
						...existingEntry,
						quantity: existingEntry.quantity + quantity,
					};
				}
			}
			remainingByItemId.set(candidate.id, remainingQuantity - quantity);
			slot.plannedQuantity += quantity;
			requestedQuantity -= quantity;
		}
	};

	// Preserve line readiness first when multiple compatible slots compete for one source.
	for (const slot of slots) {
		if (!slot.closed) allocateTo(slot, slot.minQuantity);
	}
	const remainingMissingQuantity = slots.reduce(
		(total, slot) => total + Math.max(0, slot.minQuantity - slot.plannedQuantity),
		0,
	);
	// Only material still unclaimed after every minimum may optimize range inputs toward max.
	for (const slot of slots) {
		if (!slot.closed && slot.maxQuantity > slot.minQuantity) {
			allocateTo(slot, slot.maxQuantity);
		}
	}

	return {
		entry: entries,
		storedQuantity: entries.reduce((total, entry) => total + entry.quantity, 0),
		remainingMissingQuantity,
	} satisfies planLineInputAutofillFx.Result;
});
