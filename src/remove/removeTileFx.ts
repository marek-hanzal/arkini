import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkTileRemoveReadinessFx } from "~/remove/checkTileRemoveReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/board/logic/removeBoardItemRuntimeState";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import { readBoardItemCell } from "~/board/logic/readBoardItemCell";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { rollLootTableItemsFx } from "~/loot/rollLootTableItemsFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionTileRemove } from "~/action/GameActionTileRemove";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace removeTileFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionTileRemove;
		nowMs: number;
	}
}

export const removeTileFx = Effect.fn("removeTileFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: removeTileFx.Props) {
	const checked = yield* checkTileRemoveReadinessFx({
		action,
		config,
		save,
	});
	const consumed = yield* match(checked.removal.mode)
		.with("consume", () =>
			consumeActivationInputsFx({
				inputRefs: [
					action.toolRef,
				],
				inputs: [
					{
						consume: true,
						itemId: checked.tool.itemId,
						quantity: 1,
					},
				],
				nowMs,
				reason: "remove-tool",
				save,
			}),
		)
		.with("keep", () =>
			Effect.succeed({
				events: [] satisfies GameEvent[],
				save,
			}),
		)
		.exhaustive();

	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	const seedCell = readBoardItemCell({
		itemInstanceId: checked.target.id,
		save: nextSave,
	});
	delete nextSave.board.items[checked.target.id];
	removeBoardItemRuntimeState({
		itemInstanceId: checked.target.id,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	const removalEvents = [
		...consumed.events,
		{
			itemId: checked.target.itemId,
			itemInstanceId: checked.target.id,
			reason: "tile-remove" as const,
			atMs: nowMs,
			type: "item.removed" as const,
		},
	] satisfies GameEvent[];

	const rolledOutput = checked.removal.output
		? yield* rollLootTableItemsFx({
				lootTable: {
					name: `Tile removal ${checked.target.itemId}`,
					output: checked.removal.output,
				},
			})
		: {
				items: [],
			};

	const placementRequests = rolledOutput.items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: checked.target.id,
				reason: "tile-remove-output",
			}) satisfies GameSaveItemPlacementRequest,
	);
	const placed = placementRequests.length
		? yield* placeGameSaveItemsFx({
				config,
				freedBoardItemInstanceIds: new Set([
					checked.target.id,
				]),
				items: placementRequests,
				nowMs,
				save: nextSave,
				seedCell,
			})
		: {
				events: [] satisfies GameEvent[],
				save: nextSave,
			};

	return {
		events: [
			...removalEvents,
			...placed.events,
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: placed.save,
		}),
		save: placed.save,
	} satisfies GameEngineResult;
});
