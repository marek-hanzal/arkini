import { Effect } from "effect";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type {
	LineStartReadinessScope,
	LineStartSelection,
} from "~/producer/LineStartReadinessTypes";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";

export const assertProducerQueueReadyFx = Effect.fn(
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
