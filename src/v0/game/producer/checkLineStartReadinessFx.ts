import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/v0/game/activation/checkActivationInputsFx";
import { planLineAutoFillInputRefsFx } from "~/v0/game/producer/planLineAutoFillInputRefsFx";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import { readDefaultEffectLineId } from "~/v0/game/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/v0/game/producer/readDefaultLineId";
import { readEffectLineLocked } from "~/v0/game/producer/readEffectLineLocked";
import { readVisibleLineIds } from "~/v0/game/producer/readVisibleLineIds";
import { readEffectiveLine } from "~/v0/game/effects/readEffectiveLine";
import { readLineDurationMs } from "~/v0/game/producer/readLineDurationMs";
import { readLineStoredInputQuantitiesFx } from "~/v0/game/producer/readLineStoredInputQuantitiesFx";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readLineDefinition, readLineIds } from "~/v0/game/config/GameItemCapabilities";
import type { GameActionLineStart } from "~/v0/game/action/GameActionLineStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";
import { checkProducerChargesAvailableFx } from "~/v0/game/producer/checkProducerChargesAvailableFx";

export namespace checkLineStartReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionLineStart;
	}
}

export const checkLineStartReadinessFx = Effect.fn("checkLineStartReadinessFx")(function* ({
	config,
	nowMs,
	save,
	action,
}: checkLineStartReadinessFx.Props) {
	const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx({
		config,
		itemInstanceId: action.itemInstanceId,
		save,
	});
	const visibleLineIds = readVisibleLineIds({
		config,
		producerDefinition,
		itemInstanceId: action.itemInstanceId,
		nowMs,
		lineIds: readLineIds({
			producerDefinition,
		}),
		save,
	});
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
	const lineId =
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
			: defaultLineId);
	const producerStateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: action.itemInstanceId,
		save,
	});
	if (producerStateStatus.craftBusy) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"item_busy",
				`Producer item "${action.itemInstanceId}" has a running craft job.`,
			),
		);
	}

	if (
		!lineId ||
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
	if (!visibleLineIds.includes(lineId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "${lineId}" is hidden for the current game state.`,
			),
		);
	}

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

	if (producerJobCount >= producerDefinition.maxQueueSize) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_queue_full",
				`Producer item "${action.itemInstanceId}" queue is full (${producerJobCount}/${producerDefinition.maxQueueSize}).`,
			),
		);
	}

	const line = readLineDefinition({
		producerDefinition,
		lineId,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing line "${lineId}" on producer "${producerId}".`,
			),
		);
	}
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
	if (line.output && effectiveLine.lootPlan.baseOutput.length === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"effect:disabled-output",
				`Line "${lineId}" has no enabled drops for the current game state.`,
			),
		);
	}
	if (
		line.activatesEffectId &&
		readEffectLineLocked({
			config,
			nowMs,
			itemInstanceId: action.itemInstanceId,
			lineId,
			save,
		})
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"item_busy",
				`Effect line "${lineId}" is already active for producer item "${action.itemInstanceId}".`,
			),
		);
	}
	yield* match(line.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
	yield* checkProducerChargesAvailableFx({
		config,
		producerId,
		itemInstanceId: action.itemInstanceId,
		lineChargeCost: line.chargeCost,
		save,
	});

	const lineInputs = line.inputs ?? [];
	if (action.inputRefs.length > 0) {
		yield* checkActivationInputsFx({
			inputRefs: action.inputRefs,
			inputs: lineInputs,
			save,
		});
	} else {
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
		if (needsAutoFill) {
			yield* planLineAutoFillInputRefsFx({
				inputs: lineInputs,
				itemInstanceId: action.itemInstanceId,
				lineId,
				save,
			});
		}
	}

	return {
		producerDefinition,
		producerId,
		producerItem,
		line,
		lineId,
		lineInputs,
	};
});
