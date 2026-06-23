import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { findStoredRequirementSlotFx } from "~/v0/game/requirements/findStoredRequirementSlotFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { readStoredRequirementSlotsFx } from "~/v0/game/requirements/readStoredRequirementSlotsFx";
import type { GameActionStoredRequirementWithdraw } from "~/v0/game/action/GameActionStoredRequirementWithdraw";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace checkStoredRequirementWithdrawReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStoredRequirementWithdraw;
	}
}

export const checkStoredRequirementWithdrawReadinessFx = Effect.fn(
	"checkStoredRequirementWithdrawReadinessFx",
)(function* ({ config, save, action }: checkStoredRequirementWithdrawReadinessFx.Props) {
	const slots = yield* readStoredRequirementSlotsFx({
		config,
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	const slot = yield* findStoredRequirementSlotFx({
		itemId: action.itemId,
		storedRequirements: slots.storedRequirements,
	});
	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	const previousQuantity = readGameItemQuantity({
		itemId: action.itemId,
		quantities: storedItems,
	});
	if (previousQuantity < action.quantity) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Stored requirement "${action.itemId}" quantity unavailable (${previousQuantity}/${action.quantity}).`,
			),
		);
	}

	return {
		nextQuantity: previousQuantity - action.quantity,
		previousQuantity,
		slot,
		targetItem: slots.targetItem,
	};
});
