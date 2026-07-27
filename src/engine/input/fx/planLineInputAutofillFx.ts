import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveInputMaterialFx } from "~/engine/input/fx/resolveInputMaterialFx";
import { isMaterialInputEligible } from "~/engine/input/read/readMaterialInputEligibilityFx";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { matchesItemSelector } from "~/engine/selector/fx/selectItemsFx";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

export namespace planLineInputAutofillFx {
	export interface Props {
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
		scope: candidate.location.scope === LocationScopeEnumSchema.enum.Board ? 0 : 1,
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
 * Sources prefer the owner's board space by distance, then fall back to Inventory slot order.
 * The plan fills only each slot's minimum missing quantity and never mutates runtime truth itself.
 */
export const planLineInputAutofillFx = Effect.fn("planLineInputAutofillFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: planLineInputAutofillFx.Props) {
	const { line, owner } = yield* readBoardItemLineFx({
		ownerItemId,
		lineId,
		runtime,
	});

	const candidates = runtime.items
		.filter(
			(candidate): candidate is GridRuntimeItemSchema.Type =>
				(candidate.location.scope === LocationScopeEnumSchema.enum.Board &&
					candidate.location.space === owner.location.space) ||
				candidate.location.scope === LocationScopeEnumSchema.enum.Inventory,
		)
		.filter((candidate) => candidate.id !== owner.id)
		.slice()
		.sort(compareCandidates(owner));
	const remainingByItemId = new Map(
		candidates.map((candidate) => [
			candidate.id,
			candidate.quantity,
		]),
	);
	const entries: planLineInputAutofillFx.Entry[] = [];
	let remainingMissingQuantity = 0;

	for (const [inputIndex, input] of line.input.entries()) {
		if (input.type !== InputEnumSchema.enum.Materials) continue;

		const storedItems = runtime.items.filter(
			(item) =>
				item.location.scope === LocationScopeEnumSchema.enum.Input &&
				item.location.ownerItemId === ownerItemId &&
				item.location.lineId === lineId &&
				item.location.inputIndex === inputIndex,
		);
		let storedQuantity = storedItems.reduce((total, item) => total + item.quantity, 0);
		const initialResolution = yield* resolveInputMaterialFx({
			input,
			storedQuantity,
		});
		if (initialResolution.missingQuantity === 0) continue;

		const closed = yield* isLineInputClosedFx({
			input,
			ownerItemId,
			lineId,
			runtime,
		});
		if (closed) {
			remainingMissingQuantity += initialResolution.missingQuantity;
			continue;
		}

		let missingQuantity = initialResolution.missingQuantity;
		for (const candidate of candidates) {
			if (missingQuantity === 0) break;
			const remainingQuantity = remainingByItemId.get(candidate.id) ?? 0;
			if (remainingQuantity === 0) continue;

			if (
				!isMaterialInputEligible(candidate.item) ||
				!matchesItemSelector({
					item: candidate.item,
					selector: input.selector,
				})
			) {
				continue;
			}
			const quantity = Math.min(
				remainingQuantity,
				missingQuantity,
				initialResolution.maxStoredQuantity - storedQuantity,
			);
			if (quantity === 0) continue;

			entries.push({
				inputIndex,
				sourceItemId: candidate.id,
				quantity,
			});
			remainingByItemId.set(candidate.id, remainingQuantity - quantity);
			storedQuantity += quantity;
			missingQuantity -= quantity;
		}

		remainingMissingQuantity += missingQuantity;
	}

	return {
		entry: entries,
		storedQuantity: entries.reduce((total, entry) => total + entry.quantity, 0),
		remainingMissingQuantity,
	} satisfies planLineInputAutofillFx.Result;
});
