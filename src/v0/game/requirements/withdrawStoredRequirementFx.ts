import { Effect } from "effect";
import { checkStoredRequirementWithdrawReadinessFx } from "~/v0/game/requirements/checkStoredRequirementWithdrawReadinessFx";
import { placeGameSaveInventoryItemsFx } from "~/v0/game/placement/placeGameSaveInventoryItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionStoredRequirementWithdraw } from "~/v0/game/engine/model/GameActionStoredRequirementWithdraw";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace withdrawStoredRequirementFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStoredRequirementWithdraw;
		nowMs: number;
	}
}

export const withdrawStoredRequirementFx = Effect.fn("withdrawStoredRequirementFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: withdrawStoredRequirementFx.Props) {
	const checked = yield* checkStoredRequirementWithdrawReadinessFx({
		action,
		config,
		save,
	});
	const placement = yield* placeGameSaveInventoryItemsFx({
		config,
		items: [
			{
				itemId: action.itemId,
				originItemInstanceId: action.targetItemInstanceId,
				quantity: action.quantity,
				reason: "stored-requirement-withdraw",
			},
		],
		nowMs,
		save,
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			Effect.fail(
				GameEngineError.actionRejected(
					error.reason,
					`Stored requirement "${action.itemId}" cannot be withdrawn because there is no placement space.`,
				),
			),
		),
	);

	const targetState = placement.save.storedRequirements[action.targetItemInstanceId] ?? {
		items: {},
	};
	if (checked.nextQuantity > 0) {
		targetState.items[action.itemId] = checked.nextQuantity;
		placement.save.storedRequirements[action.targetItemInstanceId] = targetState;
	} else {
		delete targetState.items[action.itemId];
		if (Object.keys(targetState.items).length > 0) {
			placement.save.storedRequirements[action.targetItemInstanceId] = targetState;
		} else {
			delete placement.save.storedRequirements[action.targetItemInstanceId];
		}
	}
	placement.save.updatedAtMs = nowMs;

	const events: GameEvent[] = [
		{
			itemId: action.itemId,
			nextQuantity: checked.nextQuantity,
			previousQuantity: checked.previousQuantity,
			quantity: action.quantity,
			targetItemInstanceId: action.targetItemInstanceId,
			type: "stored_requirement.withdrawn",
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
