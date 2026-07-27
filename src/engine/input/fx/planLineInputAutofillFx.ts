import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveInputMaterialFx } from "~/engine/input/fx/resolveInputMaterialFx";
import { isMaterialInputEligible } from "~/engine/input/read/readMaterialInputEligibilityFx";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
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
	readonly candidate: BoardRuntimeItemSchema.Type;
	readonly owner: BoardRuntimeItemSchema.Type;
}) => {
	return {
		distance:
			Math.abs(candidate.location.position.x - owner.location.position.x) +
			Math.abs(candidate.location.position.y - owner.location.position.y),
		position: candidate.location.position.y * 10_000 + candidate.location.position.x,
	};
};

const compareCandidates = (owner: BoardRuntimeItemSchema.Type) => {
	return (left: BoardRuntimeItemSchema.Type, right: BoardRuntimeItemSchema.Type) => {
		const leftRank = candidateRank({
			candidate: left,
			owner,
		});
		const rightRank = candidateRank({
			candidate: right,
			owner,
		});

		return (
			leftRank.distance - rightRank.distance ||
			leftRank.position - rightRank.position ||
			left.id.localeCompare(right.id)
		);
	};
};

/**
 * Plans deterministic automatic material delivery for one exact line.
 *
 * Sources are limited to the owner's board space. The plan fills only each
 * slot's minimum missing quantity and never mutates runtime truth by itself.
 */
export const planLineInputAutofillFx = Effect.fn("planLineInputAutofillFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: planLineInputAutofillFx.Props) {
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(yield* isBoardRuntimeItemFx(runtimeOwner));
	if (owner === undefined) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: runtimeOwner.id,
				location: runtimeOwner.location,
			}),
		);
	}

	const line = yield* readItemLineFx({
		item: owner.item,
		lineId,
	});
	if (line === undefined) {
		return yield* Effect.fail(
			new LineNotFoundError({
				itemId: owner.id,
				lineId,
			}),
		);
	}

	const candidates = runtime.items
		.filter(
			(candidate): candidate is BoardRuntimeItemSchema.Type =>
				candidate.location.scope === LocationScopeEnumSchema.enum.Board,
		)
		.filter(
			(candidate) =>
				candidate.id !== owner.id && candidate.location.space === owner.location.space,
		)
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
