import { Effect } from "effect";
import { match } from "ts-pattern";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import { readBoardItemCellFx } from "~/board/readBoardItemCellFx";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import type { GameActionTileRemoveSchema } from "~/action/GameActionTileRemoveSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { rollLootTableItemsFx } from "~/loot/rollLootTableItemsFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { checkTileRemoveReadinessFx } from "~/remove/checkTileRemoveReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace removeTileFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionTileRemoveSchema.Type;
		nowMs: number;
	}
}

type TileRemoveReadiness = Effect.Effect.Success<ReturnType<typeof checkTileRemoveReadinessFx>>;

type TileRemoveWorkingState = {
	checked: TileRemoveReadiness;
	nextSave: GameSave;
	removalEvents: GameEvent[];
	seedCell: Effect.Effect.Success<ReturnType<typeof readBoardItemCellFx>>;
};

const readTileRemoveReadinessFx = Effect.fn("removeTileFx.readTileRemoveReadinessFx")(function* ({
	action,
	config,
	save,
}: Pick<removeTileFx.Props, "action" | "config" | "save">) {
	return yield* checkTileRemoveReadinessFx({
		action,
		config,
		save,
	});
});

const consumeRemoveToolFx = Effect.fn("removeTileFx.consumeRemoveToolFx")(function* ({
	action,
	checked,
	nowMs,
	save,
}: Pick<removeTileFx.Props, "action" | "nowMs" | "save"> & {
	checked: TileRemoveReadiness;
}) {
	return yield* match(checked.removal.mode)
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
});

const removeTileTargetFromBoardFx = Effect.fn("removeTileFx.removeTileTargetFromBoardFx")(
	function* ({ checked, nextSave }: { checked: TileRemoveReadiness; nextSave: GameSave }) {
		yield* removeBoardItemFromSaveFx({
			itemInstanceId: checked.target.id,
			runtimeState: "remove",
			save: nextSave,
		});
	},
);

const createTileRemoveWorkingStateFx = Effect.fn("removeTileFx.createTileRemoveWorkingStateFx")(
	function* ({
		action,
		checked,
		nowMs,
		save,
	}: Pick<removeTileFx.Props, "action" | "nowMs" | "save"> & {
		checked: TileRemoveReadiness;
	}) {
		const consumed = yield* consumeRemoveToolFx({
			action,
			checked,
			nowMs,
			save,
		});
		const nextSave = yield* cloneGameSaveFx({
			save: consumed.save,
		});
		const seedCell = yield* readBoardItemCellFx({
			itemInstanceId: checked.target.id,
			save: nextSave,
		});
		yield* removeTileTargetFromBoardFx({
			checked,
			nextSave,
		});
		nextSave.updatedAtMs = nowMs;

		return {
			checked,
			nextSave,
			removalEvents: [
				...consumed.events,
				{
					itemId: checked.target.itemId,
					itemInstanceId: checked.target.id,
					reason: "tile-remove" as const,
					atMs: nowMs,
					type: "item.removed" as const,
				},
			],
			seedCell,
		} satisfies TileRemoveWorkingState;
	},
);

const rollTileRemoveOutputPlacementRequestsFx = Effect.fn(
	"removeTileFx.rollTileRemoveOutputPlacementRequestsFx",
)(function* ({ checked }: TileRemoveWorkingState) {
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

	return rolledOutput.items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: checked.target.id,
				reason: "tile-remove-output",
			}) satisfies GameSaveItemPlacementRequest,
	);
});

const placeTileRemoveOutputsFx = Effect.fn("removeTileFx.placeTileRemoveOutputsFx")(function* ({
	config,
	nowMs,
	state,
}: Pick<removeTileFx.Props, "config" | "nowMs"> & {
	state: TileRemoveWorkingState;
}) {
	const placementRequests = yield* rollTileRemoveOutputPlacementRequestsFx(state);
	if (placementRequests.length === 0) {
		return {
			events: [] satisfies GameEvent[],
			save: state.nextSave,
		};
	}

	return yield* placeGameSaveItemsFx({
		config,
		freedBoardItemInstanceIds: new Set([
			state.checked.target.id,
		]),
		items: placementRequests,
		nowMs,
		save: state.nextSave,
		seedCell: state.seedCell,
	});
});

const buildRemoveTileResultFx = Effect.fn("removeTileFx.buildRemoveTileResultFx")(function* ({
	config,
	nowMs,
	state,
}: Pick<removeTileFx.Props, "config" | "nowMs"> & {
	state: TileRemoveWorkingState;
}) {
	const placed = yield* placeTileRemoveOutputsFx({
		config,
		nowMs,
		state,
	});

	return yield* createGameEngineResultFx({
		config,
		events: [
			...state.removalEvents,
			...placed.events,
		],
		nowMs,
		save: placed.save,
	});
});

const removeTileProgramFx = Effect.fn("removeTileFx.removeTileProgramFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: removeTileFx.Props) {
	const checked = yield* readTileRemoveReadinessFx({
		action,
		config,
		save,
	});
	const state = yield* createTileRemoveWorkingStateFx({
		action,
		checked,
		nowMs,
		save,
	});
	return yield* buildRemoveTileResultFx({
		config,
		nowMs,
		state,
	});
});

export const removeTileFx = Effect.fn("removeTileFx")(function* (props: removeTileFx.Props) {
	return yield* removeTileProgramFx(props);
});
