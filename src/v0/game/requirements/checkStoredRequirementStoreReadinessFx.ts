import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { findStoredRequirementSlotFx } from "~/v0/game/requirements/findStoredRequirementSlotFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { readStoredRequirementSlotsFx } from "~/v0/game/requirements/readStoredRequirementSlotsFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import type { GameActionStoredRequirementStore } from "~/v0/game/action/GameActionStoredRequirementStore";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace checkStoredRequirementStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStoredRequirementStore;
	}
}

export const checkStoredRequirementStoreReadinessFx = Effect.fn(
	"checkStoredRequirementStoreReadinessFx",
)(function* ({ config, save, action }: checkStoredRequirementStoreReadinessFx.Props) {
	const slots = yield* readStoredRequirementSlotsFx({
		config,
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs: [
			action.inputRef,
		],
		save,
	});
	const resolvedRef = resolvedRefs[0];
	if (!resolvedRef) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				"Missing stored requirement input.",
			),
		);
	}

	yield* match(resolvedRef)
		.with(
			{
				kind: "board",
			},
			(boardRef) => {
				if (boardRef.itemInstanceId !== action.targetItemInstanceId) {
					return Effect.void;
				}
				return Effect.fail(
					GameEngineError.actionRejected(
						"invalid_actor",
						"Stored requirement target cannot store itself.",
					),
				);
			},
		)
		.with(
			{
				kind: "inventory",
			},
			() => Effect.void,
		)
		.exhaustive();

	const slot = yield* findStoredRequirementSlotFx({
		itemId: resolvedRef.itemId,
		storedRequirements: slots.storedRequirements,
	});
	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	const previousQuantity = readGameItemQuantity({
		itemId: resolvedRef.itemId,
		quantities: storedItems,
	});
	const nextQuantity = previousQuantity + resolvedRef.quantity;
	if (nextQuantity > slot.capacity) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				`Stored requirement "${resolvedRef.itemId}" capacity exceeded (${nextQuantity}/${slot.capacity}).`,
			),
		);
	}

	return {
		nextQuantity,
		previousQuantity,
		resolvedRef,
		slot,
		targetItem: slots.targetItem,
	};
});
