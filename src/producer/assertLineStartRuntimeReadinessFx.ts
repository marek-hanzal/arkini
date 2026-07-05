import { Effect } from "effect";
import { match } from "ts-pattern";
import { readEffectiveLine } from "~/effects/readEffectiveLine";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { checkProducerChargesAvailableFx } from "~/producer/checkProducerChargesAvailableFx";
import { readEffectLineLocked } from "~/producer/readEffectLineLocked";
import { readLineDurationMs } from "~/producer/readLineDurationMs";
import type {
	LineStartDefinition,
	LineStartReadinessScope,
} from "~/producer/LineStartReadinessTypes";

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

export const assertLineStartRuntimeReadinessFx = Effect.fn(
	"checkLineStartReadinessFx.assertLineStartRuntimeReadinessFx",
)(function* (scope: LineStartReadinessScope, definition: LineStartDefinition) {
	yield* assertEffectiveLineReadyFx(scope, definition);
	yield* assertEffectLineNotLockedFx(scope, definition);
	yield* assertLinePlacementSupportedFx(definition);
	yield* assertProducerChargesReadyFx(scope, definition);
});
