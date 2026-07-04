import { Effect } from "effect";
import { checkCraftInputWithdrawReadinessFx } from "~/craft/checkCraftInputWithdrawReadinessFx";
import { withdrawCraftStoredInputFx } from "~/craft/withdrawCraftStoredInputFx";
import { placeWithdrawnActivationInputFx } from "~/activation/placeWithdrawnActivationInputFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionCraftInputWithdrawSchema } from "~/action/GameActionCraftInputWithdrawSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace withdrawCraftInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftInputWithdrawSchema.Type;
		nowMs: number;
	}
}

export const withdrawCraftInputFx = Effect.fn("withdrawCraftInputFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: withdrawCraftInputFx.Props) {
	const checked = yield* checkCraftInputWithdrawReadinessFx({
		action,
		config,
		save,
	});
	const placement = yield* placeWithdrawnActivationInputFx({
		config,
		failureSubject: "Craft",
		itemId: action.itemId,
		nowMs,
		originItemInstanceId: action.targetItemInstanceId,
		quantity: action.quantity,
		reason: "craft-input-withdraw",
		save,
		seedCell: {
			x: checked.target.targetItem.x,
			y: checked.target.targetItem.y,
		},
	});

	const events: GameEvent[] = [];
	yield* withdrawCraftStoredInputFx({
		events,
		itemId: action.itemId,
		nextQuantity: checked.nextQuantity,
		nextSave: placement.save,
		nowMs,
		previousQuantity: checked.previousQuantity,
		quantity: action.quantity,
		recipeId: checked.target.recipeId,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	events.push(...placement.events);
	placement.save.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: placement.save,
	});
});
