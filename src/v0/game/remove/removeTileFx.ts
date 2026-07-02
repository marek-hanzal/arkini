import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkTileRemoveReadinessFx } from "~/v0/game/remove/checkTileRemoveReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import { consumeActivationInputsFx } from "~/v0/game/activation/consumeActivationInputsFx";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { rollLootTableItemsFx } from "~/v0/game/loot/rollLootTableItemsFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionTileRemove } from "~/v0/game/action/GameActionTileRemove";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
