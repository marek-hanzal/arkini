import { Effect } from "effect";
import { checkCraftInputWithdrawReadinessFx } from "~/craft/checkCraftInputWithdrawReadinessFx";
import { placeWithdrawnActivationInputFx } from "~/activation/placeWithdrawnActivationInputFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionCraftInputWithdrawSchema } from "~/action/GameActionCraftInputWithdrawSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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

	const craftInputState = placement.save.craftInputs[action.targetItemInstanceId] ?? {
		items: {},
	};
	if (checked.nextQuantity > 0) {
		craftInputState.items[action.itemId] = checked.nextQuantity;
		placement.save.craftInputs[action.targetItemInstanceId] = craftInputState;
	} else {
		delete craftInputState.items[action.itemId];
		if (Object.keys(craftInputState.items).length > 0) {
			placement.save.craftInputs[action.targetItemInstanceId] = craftInputState;
		} else {
			delete placement.save.craftInputs[action.targetItemInstanceId];
		}
	}
	placement.save.updatedAtMs = nowMs;

	const events: GameEvent[] = [
		{
			itemId: action.itemId,
			nextQuantity: checked.nextQuantity,
			previousQuantity: checked.previousQuantity,
			quantity: action.quantity,
			recipeId: checked.target.recipeId,
			targetItemInstanceId: action.targetItemInstanceId,
			type: "craft_input.withdrawn",
			atMs: nowMs,
		},
		...placement.events,
	];

	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: placement.save,
	});
});
