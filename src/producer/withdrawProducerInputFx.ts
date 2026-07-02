import { Effect } from "effect";
import { checkProducerInputWithdrawReadinessFx } from "~/producer/checkProducerInputWithdrawReadinessFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameActionProducerInputWithdraw } from "~/action/GameActionProducerInputWithdraw";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace withdrawProducerInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputWithdraw;
		nowMs: number;
	}
}

export const withdrawProducerInputFx = Effect.fn("withdrawProducerInputFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: withdrawProducerInputFx.Props) {
	const checked = yield* checkProducerInputWithdrawReadinessFx({
		action,
		config,
		save,
	});
	const placement = yield* placeGameSaveItemsFx({
		config,
		items: [
			{
				itemId: action.itemId,
				originItemInstanceId: action.itemInstanceId,
				quantity: checked.previousQuantity,
				reason: "producer-input-withdraw",
			},
		],
		nowMs,
		save,
		seedCell: {
			x: checked.producerItem.x,
			y: checked.producerItem.y,
		},
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			Effect.fail(
				GameEngineError.actionRejected(
					error.reason,
					`Producer input "${action.itemId}" cannot be withdrawn because there is no placement space.`,
				),
			),
		),
	);

	const producerInputState = placement.save.producerInputs[action.itemInstanceId];
	const lineInputState = producerInputState?.lineInputs[action.lineId];
	if (lineInputState) {
		delete lineInputState.items[action.itemId];
		if (Object.keys(lineInputState.items).length === 0) {
			delete producerInputState.lineInputs[action.lineId];
		}
		if (Object.keys(producerInputState.lineInputs).length === 0) {
			delete placement.save.producerInputs[action.itemInstanceId];
		}
	}
	placement.save.updatedAtMs = nowMs;

	const events: GameEvent[] = [
		{
			itemId: action.itemId,
			nextQuantity: 0,
			previousQuantity: checked.previousQuantity,
			itemInstanceId: action.itemInstanceId,
			lineId: action.lineId,
			quantity: checked.previousQuantity,
			type: "producer_input.withdrawn",
			atMs: nowMs,
		},
		...placement.events,
	];

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: placement.save,
		}),
		save: placement.save,
	} satisfies GameEngineResult;
});
