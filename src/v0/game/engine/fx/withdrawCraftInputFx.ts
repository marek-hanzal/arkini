import { Effect } from "effect";
import { checkCraftInputWithdrawReadinessFx } from "~/v0/game/engine/fx/checkCraftInputWithdrawReadinessFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftInputWithdraw } from "~/v0/game/engine/model/GameActionCraftInputWithdraw";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace withdrawCraftInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftInputWithdraw;
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
	const placement = yield* placeGameSaveItemsFx({
		config,
		items: [
			{
				itemId: action.itemId,
				originItemInstanceId: action.targetItemInstanceId,
				quantity: action.quantity,
				reason: "craft-input-withdraw",
			},
		],
		nowMs,
		save,
		seedCell: {
			x: checked.target.targetItem.x,
			y: checked.target.targetItem.y,
		},
	});
	if (placement.type === "blocked") {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"placement_unavailable",
				`Craft input "${action.itemId}" cannot be withdrawn because there is no placement space.`,
			),
		);
	}

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
			withdrawnAtMs: nowMs,
		},
		...placement.events,
	];

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: placement.save,
		}),
		save: placement.save,
	} satisfies GameEngineResult;
});
