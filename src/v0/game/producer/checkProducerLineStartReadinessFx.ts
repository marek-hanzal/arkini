import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/v0/game/activation/checkActivationInputsFx";
import { planProducerLineAutoFillInputRefsFx } from "~/v0/game/producer/planProducerLineAutoFillInputRefsFx";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import { readProducerDefaultEffectLineId } from "~/v0/game/producer/readProducerDefaultEffectLineId";
import { readProducerDefaultLineId } from "~/v0/game/producer/readProducerDefaultLineId";
import { readProducerEffectLineLocked } from "~/v0/game/producer/readProducerEffectLineLocked";
import { readVisibleProducerLineIds } from "~/v0/game/producer/readVisibleProducerLineIds";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import { readProducerLineDurationMs } from "~/v0/game/producer/readProducerLineDurationMs";
import { readProducerLineStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerLineStoredInputQuantitiesFx";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerLineDefinition,
	readProducerLineIds,
} from "~/v0/game/config/GameItemCapabilities";
import type { GameActionProducerLineStart } from "~/v0/game/action/GameActionProducerLineStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";
import { checkProducerChargesAvailableFx } from "~/v0/game/producer/checkProducerChargesAvailableFx";

export namespace checkProducerLineStartReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionProducerLineStart;
	}
}

export const checkProducerLineStartReadinessFx = Effect.fn("checkProducerLineStartReadinessFx")(
	function* ({ config, nowMs, save, action }: checkProducerLineStartReadinessFx.Props) {
		const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx(
			{
				config,
				producerItemInstanceId: action.producerItemInstanceId,
				save,
			},
		);
		const visibleLineIds = readVisibleProducerLineIds({
			config,
			producerDefinition,
			producerItemInstanceId: action.producerItemInstanceId,
			nowMs,
			lineIds: readProducerLineIds({
				producerDefinition,
			}),
			save,
		});
		const defaultEffectLineId = readProducerDefaultEffectLineId({
			lineIds: visibleLineIds,
			producerItemInstanceId: action.producerItemInstanceId,
			save,
		});
		const defaultLineId = readProducerDefaultLineId({
			lineIds: visibleLineIds,
			producerItemInstanceId: action.producerItemInstanceId,
			save,
		});
		const lineId =
			action.lineId ??
			(defaultEffectLineId &&
			!readProducerEffectLineLocked({
				config,
				nowMs,
				producerItemInstanceId: action.producerItemInstanceId,
				lineId: defaultEffectLineId,
				save,
			})
				? defaultEffectLineId
				: defaultLineId);
		const producerStateStatus = readBoardItemRuntimeStateStatus({
			itemInstanceId: action.producerItemInstanceId,
			save,
		});
		if (producerStateStatus.craftBusy) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"item_busy",
					`Producer item "${action.producerItemInstanceId}" has a running craft job.`,
				),
			);
		}

		if (
			!lineId ||
			!readProducerLineIds({
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
		}).filter((facts) => facts.producerItemInstanceId === action.producerItemInstanceId);
		const producerJobCount = producerJobFacts.length;
		if (producerJobFacts.some((facts) => facts.status === "delivery_blocked")) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"producer_queue_full",
					`Producer item "${action.producerItemInstanceId}" queue is waiting for blocked delivery.`,
				),
			);
		}

		if (producerJobFacts.some((facts) => facts.status === "paused")) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"producer_queue_full",
					`Producer item "${action.producerItemInstanceId}" queue is paused by unmet effect requirements or blockers.`,
				),
			);
		}

		if (producerJobCount >= producerDefinition.maxQueueSize) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"producer_queue_full",
					`Producer item "${action.producerItemInstanceId}" queue is full (${producerJobCount}/${producerDefinition.maxQueueSize}).`,
				),
			);
		}

		const line = readProducerLineDefinition({
			producerDefinition,
			lineId,
		});
		if (!line) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Missing producer line "${lineId}" on producer "${producerId}".`,
				),
			);
		}
		const effectiveProducerLine = readEffectiveProducerLine({
			baseDurationMs: readProducerLineDurationMs({
				line,
			}),
			config,
			nowMs,
			producerItemInstanceId: action.producerItemInstanceId,
			line,
			lineId,
			save,
		});
		if (!effectiveProducerLine.startRequirementsReady) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"effect:missing-grant",
					`Line "${lineId}" is missing effect requirements for the current game state.`,
				),
			);
		}
		if (effectiveProducerLine.blocked) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"blocked",
					`Line "${lineId}" is blocked by an active effect for the current game state.`,
				),
			);
		}
		if (line.output && effectiveProducerLine.lootPlan.baseOutput.length === 0) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"effect:disabled-output",
					`Line "${lineId}" has no enabled drops for the current game state.`,
				),
			);
		}
		if (
			line.activatesEffectId &&
			readProducerEffectLineLocked({
				config,
				nowMs,
				producerItemInstanceId: action.producerItemInstanceId,
				lineId,
				save,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"item_busy",
					`Effect line "${lineId}" is already active for producer item "${action.producerItemInstanceId}".`,
				),
			);
		}
		yield* match(line.placement)
			.with("board_then_inventory", () => Effect.void)
			.exhaustive();
		yield* checkProducerChargesAvailableFx({
			config,
			producerId,
			producerItemInstanceId: action.producerItemInstanceId,
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
			const storedInputs = yield* readProducerLineStoredInputQuantitiesFx({
				producerItemInstanceId: action.producerItemInstanceId,
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
				yield* planProducerLineAutoFillInputRefsFx({
					inputs: lineInputs,
					producerItemInstanceId: action.producerItemInstanceId,
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
	},
);
