import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/activation/checkActivationInputsFx";
import { planLineAutoFillInputRefsFx } from "~/producer/planLineAutoFillInputRefsFx";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { readProducerRuntimeTargetFx } from "~/producer/readProducerRuntimeTargetFx";
import { readDefaultEffectLineId } from "~/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/producer/readDefaultLineId";
import { readEffectLineLocked } from "~/producer/readEffectLineLocked";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";
import { readEffectiveLine } from "~/effects/readEffectiveLine";
import { readLineDurationMs } from "~/producer/readLineDurationMs";
import { readLineStoredInputQuantitiesFx } from "~/producer/readLineStoredInputQuantitiesFx";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readLineDefinition, readLineIds } from "~/config/GameItemCapabilities";
import type { GameActionLineStartSchema } from "~/action/GameActionLineStartSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";
import { checkProducerChargesAvailableFx } from "~/producer/checkProducerChargesAvailableFx";

export namespace checkLineStartReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionLineStartSchema.Type;
	}
}

type LineStartTarget = Effect.Effect.Success<ReturnType<typeof readProducerRuntimeTargetFx>>;

type LineStartSelection = LineStartTarget & {
	lineId: string;
	visibleLineIds: readonly string[];
};

type LineStartDefinition = LineStartSelection & {
	line: NonNullable<ReturnType<typeof readLineDefinition>>;
	lineInputs: NonNullable<NonNullable<ReturnType<typeof readLineDefinition>>["inputs"]>;
};

type LineStartReadinessScope = checkLineStartReadinessFx.Props;

const readLineStartTargetFx = Effect.fn("checkLineStartReadinessFx.readLineStartTargetFx")(
	function* ({ action, config, save }: LineStartReadinessScope) {
		return yield* readProducerRuntimeTargetFx({
			config,
			itemInstanceId: action.itemInstanceId,
			save,
		});
	},
);

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

const readLineStartSelectionFx = Effect.fn("checkLineStartReadinessFx.readLineStartSelectionFx")(
	function* (scope: LineStartReadinessScope) {
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
	},
);

const assertProducerQueueReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertProducerQueueReadyFx",
)(function* (scope: LineStartReadinessScope, { producerDefinition }: LineStartSelection) {
	const { action, nowMs, save } = scope;
	const producerJobFacts = readWorldProducerJobFacts({
		nowMs,
		save,
	}).filter((facts) => facts.itemInstanceId === action.itemInstanceId);
	const producerJobCount = producerJobFacts.length;
	if (producerJobFacts.some((facts) => facts.status === "delivery_blocked")) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_queue_full",
				`Producer item "${action.itemInstanceId}" queue is waiting for blocked delivery.`,
			),
		);
	}

	if (producerJobFacts.some((facts) => facts.status === "paused")) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_queue_full",
				`Producer item "${action.itemInstanceId}" queue is paused by unmet effect requirements or blockers.`,
			),
		);
	}

	if (producerJobCount < producerDefinition.maxQueueSize) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"producer_queue_full",
			`Producer item "${action.itemInstanceId}" queue is full (${producerJobCount}/${producerDefinition.maxQueueSize}).`,
		),
	);
});

const readLineStartDefinitionFx = Effect.fn("checkLineStartReadinessFx.readLineStartDefinitionFx")(
	function* (selection: LineStartSelection) {
		const line = readLineDefinition({
			producerDefinition: selection.producerDefinition,
			lineId: selection.lineId,
		});
		if (!line) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Missing line "${selection.lineId}" on producer "${selection.producerId}".`,
				),
			);
		}

		return {
			...selection,
			line,
			lineInputs: line.inputs ?? [],
		} satisfies LineStartDefinition;
	},
);

const assertEffectiveLineReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertEffectiveLineReadyFx",
)(function* (scope: LineStartReadinessScope, { line, lineId }: LineStartDefinition) {
	const { action, config, nowMs, save } = scope;
	const effectiveLine = readEffectiveLine({
		baseDurationMs: readLineDurationMs({
			line,
		}),
		config,
		nowMs,
		itemInstanceId: action.itemInstanceId,
		line,
		lineId,
		save,
	});
	if (!effectiveLine.startRequirementsReady) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"effect:missing-grant",
				`Line "${lineId}" is missing effect requirements for the current game state.`,
			),
		);
	}
	if (effectiveLine.blocked) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"blocked",
				`Line "${lineId}" is blocked by an active effect for the current game state.`,
			),
		);
	}
	if (!line.output || effectiveLine.lootPlan.baseOutput.length > 0) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"effect:disabled-output",
			`Line "${lineId}" has no enabled drops for the current game state.`,
		),
	);
});

const assertEffectLineNotLockedFx = Effect.fn(
	"checkLineStartReadinessFx.assertEffectLineNotLockedFx",
)(function* (scope: LineStartReadinessScope, { line, lineId }: LineStartDefinition) {
	if (!line.effect) return;
	const { action, config, nowMs, save } = scope;
	if (
		!readEffectLineLocked({
			config,
			nowMs,
			itemInstanceId: action.itemInstanceId,
			lineId,
			save,
		})
	) {
		return;
	}

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"item_busy",
			`Effect line "${lineId}" is already active for producer item "${action.itemInstanceId}".`,
		),
	);
});

const assertLinePlacementSupportedFx = Effect.fn(
	"checkLineStartReadinessFx.assertLinePlacementSupportedFx",
)(function* ({ line }: LineStartDefinition) {
	yield* match(line.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
});

const assertProducerChargesReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertProducerChargesReadyFx",
)(function* (scope: LineStartReadinessScope, { line, producerId }: LineStartDefinition) {
	const { action, config, save } = scope;
	yield* checkProducerChargesAvailableFx({
		config,
		producerId,
		itemInstanceId: action.itemInstanceId,
		lineChargeCost: line.chargeCost,
		save,
	});
});

const assertExplicitLineInputsReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertExplicitLineInputsReadyFx",
)(function* (scope: LineStartReadinessScope, { lineInputs }: LineStartDefinition) {
	const { action, save } = scope;
	yield* checkActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: lineInputs,
		save,
	});
});

const assertStoredOrAutoFilledLineInputsReadyFx = Effect.fn(
	"checkLineStartReadinessFx.assertStoredOrAutoFilledLineInputsReadyFx",
)(function* (scope: LineStartReadinessScope, { lineId, lineInputs }: LineStartDefinition) {
	const { action, save } = scope;
	const storedInputs = yield* readLineStoredInputQuantitiesFx({
		itemInstanceId: action.itemInstanceId,
		lineId,
		save,
	});
	const needsAutoFill = lineInputs.some(
		(input) =>
			readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputs,
			}) < input.quantity,
	);
	if (!needsAutoFill) return;

	yield* planLineAutoFillInputRefsFx({
		inputs: lineInputs,
		itemInstanceId: action.itemInstanceId,
		lineId,
		save,
	});
});

const assertLineInputsReadyFx = Effect.fn("checkLineStartReadinessFx.assertLineInputsReadyFx")(
	function* (scope: LineStartReadinessScope, definition: LineStartDefinition) {
		const { action } = scope;
		yield* match(action.inputRefs.length > 0)
			.with(true, () => assertExplicitLineInputsReadyFx(scope, definition))
			.with(false, () => assertStoredOrAutoFilledLineInputsReadyFx(scope, definition))
			.exhaustive();
	},
);

const checkLineStartReadinessProgramFx = Effect.fn("checkLineStartReadinessFx.programFx")(
	function* (scope: LineStartReadinessScope) {
		yield* assertProducerTargetNotCraftBusyFx(scope);
		const selection = yield* readLineStartSelectionFx(scope);
		yield* assertProducerQueueReadyFx(scope, selection);
		const definition = yield* readLineStartDefinitionFx(selection);
		yield* assertEffectiveLineReadyFx(scope, definition);
		yield* assertEffectLineNotLockedFx(scope, definition);
		yield* assertLinePlacementSupportedFx(definition);
		yield* assertProducerChargesReadyFx(scope, definition);
		yield* assertLineInputsReadyFx(scope, definition);

		return {
			producerDefinition: definition.producerDefinition,
			producerId: definition.producerId,
			producerItem: definition.producerItem,
			line: definition.line,
			lineId: definition.lineId,
			lineInputs: definition.lineInputs,
		};
	},
);

export const checkLineStartReadinessFx = Effect.fn("checkLineStartReadinessFx")(function* (
	props: checkLineStartReadinessFx.Props,
) {
	return yield* checkLineStartReadinessProgramFx(props);
});
