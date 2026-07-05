import { Effect } from "effect";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { readLineIds } from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readDefaultEffectLineId } from "~/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/producer/readDefaultLineId";
import { readEffectLineLocked } from "~/producer/readEffectLineLocked";
import type {
	LineStartReadinessScope,
	LineStartSelection,
	LineStartTarget,
} from "~/producer/LineStartReadinessTypes";
import { readProducerRuntimeTargetFx } from "~/producer/readProducerRuntimeTargetFx";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";

const readLineStartTargetFx = Effect.fn("checkLineStartReadinessFx.readLineStartTargetFx")(
	function* ({ action, config, save }: LineStartReadinessScope) {
		return yield* readProducerRuntimeTargetFx({
			config,
			itemInstanceId: action.itemInstanceId,
			save,
		});
	},
);

const assertProducerTargetNotCraftBusyFx = Effect.fn(
	"checkLineStartReadinessFx.assertProducerTargetNotCraftBusyFx",
)(function* ({ action, save }: LineStartReadinessScope) {
	const producerStateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: action.itemInstanceId,
		save,
	});
	if (!producerStateStatus.craftBusy) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"item_busy",
			`Producer item "${action.itemInstanceId}" has a running craft job.`,
		),
	);
});

const readVisibleLineIdsFx = Effect.fn("checkLineStartReadinessFx.readVisibleLineIdsFx")(function* (
	scope: LineStartReadinessScope,
	{ producerDefinition }: LineStartTarget,
) {
	const { action, config, nowMs, save } = scope;
	return readVisibleLineIds({
		config,
		producerDefinition,
		itemInstanceId: action.itemInstanceId,
		nowMs,
		lineIds: readLineIds({
			producerDefinition,
		}),
		save,
	});
});

const readRequestedOrDefaultLineIdFx = Effect.fn(
	"checkLineStartReadinessFx.readRequestedOrDefaultLineIdFx",
)(function* (
	scope: LineStartReadinessScope,
	{
		visibleLineIds,
	}: {
		visibleLineIds: readonly string[];
	},
) {
	const { action, config, nowMs, save } = scope;
	const defaultEffectLineId = readDefaultEffectLineId({
		lineIds: visibleLineIds,
		itemInstanceId: action.itemInstanceId,
		save,
	});
	const defaultLineId = readDefaultLineId({
		lineIds: visibleLineIds,
		itemInstanceId: action.itemInstanceId,
		save,
	});
	return (
		action.lineId ??
		(defaultEffectLineId &&
		!readEffectLineLocked({
			config,
			nowMs,
			itemInstanceId: action.itemInstanceId,
			lineId: defaultEffectLineId,
			save,
		})
			? defaultEffectLineId
			: defaultLineId)
	);
});

const assertLineOwnedAndVisibleFx = Effect.fn(
	"checkLineStartReadinessFx.assertLineOwnedAndVisibleFx",
)(function* (
	{ lineId, producerDefinition, producerId, producerItem, visibleLineIds }: LineStartSelection,
	scope: LineStartReadinessScope,
) {
	const { action } = scope;
	if (
		!readLineIds({
			producerDefinition,
		}).includes(lineId)
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "${action.lineId ?? "<default>"}" does not belong to producer "${producerId}" on item "${producerItem.itemId}".`,
			),
		);
	}

	if (visibleLineIds.includes(lineId)) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"invalid_actor",
			`Line "${lineId}" is hidden for the current game state.`,
		),
	);
});

export const readLineStartSelectionFx = Effect.fn(
	"checkLineStartReadinessFx.readLineStartSelectionFx",
)(function* (scope: LineStartReadinessScope) {
	yield* assertProducerTargetNotCraftBusyFx(scope);
	const target = yield* readLineStartTargetFx(scope);
	const visibleLineIds = yield* readVisibleLineIdsFx(scope, target);
	const lineId = yield* readRequestedOrDefaultLineIdFx(scope, {
		visibleLineIds,
	});
	if (!lineId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "<default>" does not belong to producer "${target.producerId}" on item "${target.producerItem.itemId}".`,
			),
		);
	}

	const selection = {
		...target,
		lineId,
		visibleLineIds,
	} satisfies LineStartSelection;
	yield* assertLineOwnedAndVisibleFx(selection, scope);
	return selection;
});
