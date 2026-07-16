import { Effect } from "effect";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import type { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";
import type { GameActionItemStackSchema } from "~/action/GameActionItemStackSchema";
import { addBoardItemQuantityFx } from "~/board/addBoardItemQuantityFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { pushBoardItemCreatedEventFx } from "~/placement/pushBoardItemCreatedEventFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { checkItemStackReadinessFx } from "~/stack/checkItemStackReadinessFx";

export namespace stackItemFx {
	export interface Props {
		action: GameActionItemStackSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const createConsumptionSourceRef = ({
	moveQuantity,
	sourceRef,
}: {
	moveQuantity: number;
	sourceRef: GameActionItemRefSchema.Type;
}): GameActionItemRefSchema.Type =>
	sourceRef.kind === "board"
		? {
				kind: "board" as const,
				itemInstanceId: sourceRef.itemInstanceId,
				quantity: moveQuantity,
			}
		: {
				kind: "inventory" as const,
				quantity: moveQuantity,
				slotIndex: sourceRef.slotIndex,
			};

export const stackItemFx = Effect.fn("stackItemFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: stackItemFx.Props) {
	const checked = yield* checkItemStackReadinessFx({
		action,
		config,
		save,
	});
	const consumed = yield* consumeActivationInputsFx({
		inputRefs: [
			createConsumptionSourceRef({
				moveQuantity: checked.moveQuantity,
				sourceRef: action.sourceRef,
			}),
		],
		inputs: [
			{
				consume: true,
				itemId: checked.target.itemId,
				quantity: checked.moveQuantity,
			},
		],
		nowMs,
		reason: "board-stack",
		save,
	});
	const updated = yield* addBoardItemQuantityFx({
		itemInstanceId: checked.target.id,
		quantity: checked.moveQuantity,
		save: consumed.save,
	});
	yield* pushBoardItemCreatedEventFx({
		cell: {
			x: updated.item.x,
			y: updated.item.y,
		},
		events: consumed.events,
		itemId: checked.target.itemId,
		itemInstanceId: checked.target.id,
		quantity: checked.moveQuantity,
		reason: "board-stack",
	});
	consumed.save.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: consumed.events,
		nowMs,
		save: consumed.save,
	});
});
