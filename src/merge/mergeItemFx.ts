import { Context, Effect } from "effect";
import { match, P } from "ts-pattern";
import { checkItemMergeReadinessFx } from "~/merge/checkItemMergeReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import { readBoardItemCellFx } from "~/board/logic/readBoardItemCellFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { rollLootTableItemsFx } from "~/loot/rollLootTableItemsFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionItemMergeSchema } from "~/action/GameActionItemMergeSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace mergeItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionItemMergeSchema.Type;
		nowMs: number;
	}
}

type MergeReadiness = Effect.Effect.Success<ReturnType<typeof checkItemMergeReadinessFx>>;

type MergeWorkingState = {
	checked: MergeReadiness;
	mergeEvents: GameEvent[];
	nextSave: GameSave;
};

class MergeItemScopeFx extends Context.Tag("MergeItemScopeFx")<
	MergeItemScopeFx,
	mergeItemFx.Props
>() {
	//
}

const readMergeReadinessFx = Effect.fn("mergeItemFx.readMergeReadinessFx")(function* () {
	const { action, config, nowMs, save } = yield* MergeItemScopeFx;
	return yield* checkItemMergeReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
});

const consumeMergeSourceFx = Effect.fn("mergeItemFx.consumeMergeSourceFx")(function* ({
	checked,
}: {
	checked: MergeReadiness;
}) {
	const { action, nowMs, save } = yield* MergeItemScopeFx;
	return yield* consumeActivationInputsFx({
		inputRefs: [
			action.sourceRef,
		],
		inputs: [
			{
				consume: true,
				itemId: checked.source.itemId,
				quantity: 1,
			},
		],
		nowMs,
		reason: "merge-source",
		save,
	});
});

const createMergeWorkingStateFx = Effect.fn("mergeItemFx.createMergeWorkingStateFx")(function* ({
	checked,
}: {
	checked: MergeReadiness;
}) {
	const consumed = yield* consumeMergeSourceFx({
		checked,
	});
	return {
		checked,
		mergeEvents: [
			...consumed.events,
		],
		nextSave: yield* cloneGameSaveFx({
			save: consumed.save,
		}),
	} satisfies MergeWorkingState;
});

const assertLiveMergeTargetFx = Effect.fn("mergeItemFx.assertLiveMergeTargetFx")(function* ({
	checked,
	nextSave,
}: MergeWorkingState) {
	const liveTarget = nextSave.board.items[checked.target.id];
	if (liveTarget) return liveTarget;

	return yield* Effect.fail(
		GameEngineError.actionRejected("invalid_merge", "Merge target disappeared."),
	);
});

const applyMergeResultReplacementFx = Effect.fn("mergeItemFx.applyMergeResultReplacementFx")(
	function* (state: MergeWorkingState) {
		const { config, nowMs } = yield* MergeItemScopeFx;
		const { checked, mergeEvents, nextSave } = state;
		const resultItemId = match(checked.merge)
			.with(
				{
					resultItemId: P.string,
				},
				(merge) => merge.resultItemId,
			)
			.otherwise(() => undefined);
		if (!resultItemId) return state;

		const liveTarget = yield* assertLiveMergeTargetFx(state);
		if (config.items[resultItemId]?.effects?.length) {
			liveTarget.createdAtMs = nowMs;
		} else {
			delete liveTarget.createdAtMs;
		}
		liveTarget.itemId = resultItemId;
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: checked.target.id,
			save: nextSave,
		});
		mergeEvents.push({
			atMs: nowMs,
			fromItemId: checked.target.itemId,
			itemInstanceId: checked.target.id,
			reason: "merge-result" as const,
			toItemId: resultItemId,
			type: "item.replaced" as const,
		});
		return state;
	},
);

const rollMergeOutputPlacementRequestsFx = Effect.fn(
	"mergeItemFx.rollMergeOutputPlacementRequestsFx",
)(function* ({ checked }: MergeWorkingState) {
	const rolledOutput = checked.merge.output
		? yield* rollLootTableItemsFx({
				lootTable: {
					name: `Merge ${checked.source.itemId} + ${checked.target.itemId}`,
					output: checked.merge.output,
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
				reason: "merge-output",
			}) satisfies GameSaveItemPlacementRequest,
	);
});

const readMergeSourceFreedBoardItemInstanceIds = ({ checked }: { checked: MergeReadiness }) =>
	checked.source.kind === "board"
		? new Set([
				checked.source.itemInstanceId,
			])
		: undefined;

const placeMergeOutputsFx = Effect.fn("mergeItemFx.placeMergeOutputsFx")(function* (
	state: MergeWorkingState,
) {
	const { config, nowMs } = yield* MergeItemScopeFx;
	const placementRequests = yield* rollMergeOutputPlacementRequestsFx(state);
	if (placementRequests.length === 0) {
		return {
			events: [] satisfies GameEvent[],
			save: state.nextSave,
		};
	}

	return yield* placeGameSaveItemsFx({
		config,
		freedBoardItemInstanceIds: readMergeSourceFreedBoardItemInstanceIds({
			checked: state.checked,
		}),
		items: placementRequests,
		nowMs,
		save: state.nextSave,
		seedCell: yield* readBoardItemCellFx({
			itemInstanceId: state.checked.target.id,
			save: state.nextSave,
		}),
	});
});

const buildMergeResultFx = Effect.fn("mergeItemFx.buildMergeResultFx")(function* (
	state: MergeWorkingState,
) {
	const { config, nowMs } = yield* MergeItemScopeFx;
	const placed = yield* placeMergeOutputsFx(state);
	placed.save.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events: [
			...state.mergeEvents,
			...placed.events,
		],
		nowMs,
		save: placed.save,
	});
});

const mergeItemProgramFx = Effect.fn("mergeItemFx.mergeItemProgramFx")(function* () {
	const checked = yield* readMergeReadinessFx();
	const state = yield* createMergeWorkingStateFx({
		checked,
	});
	return yield* buildMergeResultFx(yield* applyMergeResultReplacementFx(state));
});

export const mergeItemFx = Effect.fn("mergeItemFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: mergeItemFx.Props) {
	return yield* mergeItemProgramFx().pipe(
		Effect.provideService(MergeItemScopeFx, {
			action,
			config,
			nowMs,
			save,
		}),
	);
});
