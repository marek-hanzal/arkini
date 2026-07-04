import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { blockedProducerDeliveryRetryDelayMs } from "~/producer/producerDeliveryTiming";
import { readBoardItemCellFx } from "~/board/readBoardItemCellFx";
import { rescheduleProducerQueueAfterBlockedDeliveryFx } from "~/producer/rescheduleProducerQueueAfterBlockedDeliveryFx";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { readProducerJobEffectiveLineFx } from "~/producer/readProducerJobEffectiveLineFx";
import { removeProducerJobFromSaveFx } from "~/producer/removeProducerJobFromSaveFx";
import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import { readLineDefinition } from "~/config/GameItemCapabilities";
import { readProducerRemainingCharges } from "~/producer/readProducerRemainingCharges";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import { rollEffectiveLootPlanItemsFx } from "~/effects/rollEffectiveLootPlanItemsFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { replaceDepletedProducerSourceCellOutputFx } from "~/producer/replaceDepletedProducerSourceCellOutputFx";

export namespace completeProducerJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveProducerJob;
		nowMs: number;
	}
}

type ProducerDeliveryItem = {
	itemId: string;
	quantity: number;
};

type ProducerChargeCompletionOutcome = {
	producerId: string;
	nextRemainingCharges: number;
	removeOnDepleted: boolean;
};

type ProducerCompletionEvents = GameEngineCompletionResult["events"];

type ProducerPlacementSuccess = Effect.Effect.Success<ReturnType<typeof placeGameSaveItemsFx>>;

type ProducerPlacementFailure = Extract<
	Effect.Effect.Error<ReturnType<typeof placeGameSaveItemsFx>>,
	{
		_tag: "GamePlacementFailed";
	}
>;

type ProducerJobCompletionScope = completeProducerJobFx.Props;

const createLineCompletedEvent = ({ job, nowMs }: { job: GameSaveProducerJob; nowMs: number }) => ({
	atMs: nowMs,
	jobId: job.id,
	itemInstanceId: job.itemInstanceId,
	lineId: job.lineId,
	type: "line.completed" as const,
});

const createLineFailedEvent = ({
	error,
	job,
	nowMs,
}: {
	error: ProducerPlacementFailure;
	job: GameSaveProducerJob;
	nowMs: number;
}) => ({
	atMs: nowMs,
	jobId: job.id,
	itemInstanceId: job.itemInstanceId,
	lineId: job.lineId,
	reason: error.reason,
	type: "line.failed" as const,
});

const createLineBlockedEvent = ({
	error,
	job,
	nowMs,
}: {
	error: ProducerPlacementFailure;
	job: GameSaveProducerJob;
	nowMs: number;
}) => ({
	atMs: nowMs,
	jobId: job.id,
	itemInstanceId: job.itemInstanceId,
	lineId: job.lineId,
	reason: error.reason,
	type: "line.blocked" as const,
});

const createProducerChargesDepletedRemovalEvent = ({
	job,
	nowMs,
	producerId,
}: {
	job: GameSaveProducerJob;
	nowMs: number;
	producerId: string;
}) => ({
	atMs: nowMs,
	itemId: producerId,
	itemInstanceId: job.itemInstanceId,
	reason: "producer-depleted" as const,
	type: "item.removed" as const,
});

const createCompletedResult = ({
	chargeEvents,
	job,
	nowMs,
	placementEvents = [],
	save,
}: {
	chargeEvents: ProducerCompletionEvents;
	job: GameSaveProducerJob;
	nowMs: number;
	placementEvents?: ProducerCompletionEvents;
	save: GameSave;
}) =>
	({
		events: [
			createLineCompletedEvent({
				job,
				nowMs,
			}),
			...chargeEvents,
			...placementEvents,
		],
		save,
		type: "completed" as const,
	}) satisfies GameEngineCompletionResult;

const toPlacementRequests = ({
	items,
	itemInstanceId,
}: {
	items: readonly ProducerDeliveryItem[];
	itemInstanceId: string;
}) =>
	items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: itemInstanceId,
				reason: "line-output",
			}) satisfies GameSaveItemPlacementRequest,
	);

const readLiveProducerJobFx = Effect.fn("completeProducerJobFx.readLiveProducerJobFx")(function* (
	scope: ProducerJobCompletionScope,
) {
	return scope.save.producerJobs[scope.job.id];
});

const readLiveProducerLineFx = Effect.fn("completeProducerJobFx.readLiveProducerLineFx")(
	function* ({
		liveJob,
		scope,
	}: {
		liveJob: GameSaveProducerJob;
		scope: ProducerJobCompletionScope;
	}) {
		const { config, save } = scope;
		const producerItem = save.board.items[liveJob.itemInstanceId];
		const producer = producerItem
			? readProducerCapabilityDefinition({
					config,
					producerId: producerItem.itemId,
				})
			: undefined;
		const line = producer
			? readLineDefinition({
					producerDefinition: producer,
					lineId: liveJob.lineId,
				})
			: undefined;
		if (line) return line;

		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing line "${liveJob.lineId}".`),
		);
	},
);

const assertProducerLinePlacementSupportedFx = Effect.fn(
	"completeProducerJobFx.assertProducerLinePlacementSupportedFx",
)(function* (line: Effect.Effect.Success<ReturnType<typeof readLiveProducerLineFx>>) {
	yield* match(line.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
});

const rollProducerDeliveryItemsFx = Effect.fn("completeProducerJobFx.rollProducerDeliveryItemsFx")(
	function* ({ job, scope }: { job: GameSaveProducerJob; scope: ProducerJobCompletionScope }) {
		const { config, nowMs, save } = scope;
		const effectiveLine = yield* readProducerJobEffectiveLineFx({
			config,
			nowMs,
			itemInstanceId: job.itemInstanceId,
			lineId: job.lineId,
			save,
		});
		return (yield* rollEffectiveLootPlanItemsFx({
			config,
			lootPlan: effectiveLine.lootPlan,
		})).items;
	},
);

const readProducerChargeCompletionOutcomeFx = Effect.fn(
	"completeProducerJobFx.readProducerChargeCompletionOutcomeFx",
)(function* ({
	job,
	save,
	scope,
}: {
	job: GameSaveProducerJob;
	save: GameSave;
	scope: ProducerJobCompletionScope;
}) {
	const { config } = scope;
	const producerItem = save.board.items[job.itemInstanceId];
	if (!producerItem) return undefined;

	const producerId = producerItem.itemId;
	const producer = readProducerCapabilityDefinition({
		config,
		producerId,
	});
	const line = producer
		? readLineDefinition({
				producerDefinition: producer,
				lineId: job.lineId,
			})
		: undefined;
	if (!producer || !line || producer.charges === undefined || line.chargeCost <= 0) {
		return undefined;
	}

	const remainingCharges = readProducerRemainingCharges({
		config,
		producerId,
		itemInstanceId: job.itemInstanceId,
		save,
	});
	if (remainingCharges === undefined) return undefined;

	const nextRemainingCharges = Math.max(0, remainingCharges - line.chargeCost);

	return {
		nextRemainingCharges,
		producerId,
		removeOnDepleted: nextRemainingCharges === 0 && producer.onChargesDepleted === "remove",
	} satisfies ProducerChargeCompletionOutcome;
});

const spendProducerChargeCostAfterCompletedDeliveryFx = Effect.fn(
	"completeProducerJobFx.spendProducerChargeCostAfterCompletedDeliveryFx",
)(function* ({
	job,
	nextSave,
	scope,
}: {
	job: GameSaveProducerJob;
	nextSave: GameSave;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs } = scope;
	const outcome = yield* readProducerChargeCompletionOutcomeFx({
		job,
		save: nextSave,
		scope,
	});
	if (!outcome) return [] satisfies ProducerCompletionEvents;

	nextSave.producerCharges[job.itemInstanceId] = {
		remainingCharges: outcome.nextRemainingCharges,
	};

	if (!outcome.removeOnDepleted) {
		return [] satisfies ProducerCompletionEvents;
	}

	yield* removeBoardItemFromSaveFx({
		itemInstanceId: job.itemInstanceId,
		runtimeState: "remove",
		save: nextSave,
	});

	return [
		createProducerChargesDepletedRemovalEvent({
			job,
			nowMs,
			producerId: outcome.producerId,
		}),
	] satisfies ProducerCompletionEvents;
});

const rescheduleQueueAfterCompletedDeliveryFx = Effect.fn(
	"completeProducerJobFx.rescheduleQueueAfterCompletedDeliveryFx",
)(function* ({
	liveJob,
	nextSave,
	resumeAtMs,
	scope,
}: {
	liveJob: GameSaveProducerJob;
	nextSave: GameSave;
	resumeAtMs: number;
	scope: ProducerJobCompletionScope;
}) {
	if (!liveJob.delivery) return;
	const { config } = scope;

	yield* rescheduleProducerQueueAfterBlockedDeliveryFx({
		blockedJobId: liveJob.id,
		config,
		nextSave,
		itemInstanceId: liveJob.itemInstanceId,
		resumeAtMs,
	});
});

const completeProducerJobWithoutDeliveryItemsFx = Effect.fn(
	"completeProducerJobFx.completeProducerJobWithoutDeliveryItemsFx",
)(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs, save } = scope;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	yield* removeProducerJobFromSaveFx({
		jobId: liveJob.id,
		save: nextSave,
	});
	const chargeEvents = yield* spendProducerChargeCostAfterCompletedDeliveryFx({
		job: liveJob,
		nextSave,
		scope,
	});
	yield* rescheduleQueueAfterCompletedDeliveryFx({
		liveJob,
		nextSave,
		resumeAtMs: nowMs,
		scope,
	});
	nextSave.updatedAtMs = nowMs;

	return createCompletedResult({
		chargeEvents,
		job: liveJob,
		nowMs,
		save: nextSave,
	});
});

const completeFailedProducerDeliveryFx = Effect.fn(
	"completeProducerJobFx.completeFailedProducerDeliveryFx",
)(function* ({
	error,
	liveJob,
	scope,
}: {
	error: ProducerPlacementFailure;
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs, save } = scope;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	yield* removeProducerJobFromSaveFx({
		jobId: liveJob.id,
		save: nextSave,
	});
	yield* rescheduleQueueAfterCompletedDeliveryFx({
		liveJob,
		nextSave,
		resumeAtMs: nowMs,
		scope,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			createLineCompletedEvent({
				job: liveJob,
				nowMs,
			}),
			createLineFailedEvent({
				error,
				job: liveJob,
				nowMs,
			}),
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});

const completeBlockedProducerDeliveryFx = Effect.fn(
	"completeProducerJobFx.completeBlockedProducerDeliveryFx",
)(function* ({
	error,
	liveJob,
	scope,
}: {
	error: ProducerPlacementFailure;
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { config, nowMs, save } = scope;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const nextAttemptAtMs = nowMs + blockedProducerDeliveryRetryDelayMs;
	nextSave.producerJobs[liveJob.id] = {
		...liveJob,
		delivery: {
			lastBlockedAtMs: nowMs,
			nextAttemptAtMs,
		},
	};
	yield* rescheduleProducerQueueAfterBlockedDeliveryFx({
		blockedJobId: liveJob.id,
		config,
		nextSave,
		itemInstanceId: liveJob.itemInstanceId,
		resumeAtMs: nextAttemptAtMs,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events:
			liveJob.delivery?.lastBlockedAtMs === undefined
				? [
						createLineBlockedEvent({
							error,
							job: liveJob,
							nowMs,
						}),
					]
				: [],
		save: nextSave,
		type: "blocked" as const,
	} satisfies GameEngineCompletionResult;
});

const completeProducerPlacementFailureFx = Effect.fn(
	"completeProducerJobFx.completeProducerPlacementFailureFx",
)(function* ({
	error,
	liveJob,
	scope,
}: {
	error: ProducerPlacementFailure;
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	return yield* match(isGamePlacementFailureRetryable(error.reason))
		.with(false, () =>
			completeFailedProducerDeliveryFx({
				error,
				liveJob,
				scope,
			}),
		)
		.with(true, () =>
			completeBlockedProducerDeliveryFx({
				error,
				liveJob,
				scope,
			}),
		)
		.exhaustive();
});

const readProducerPlacementEitherFx = Effect.fn(
	"completeProducerJobFx.readProducerPlacementEitherFx",
)(function* ({
	chargeOutcome,
	deliveryItems,
	liveJob,
	scope,
}: {
	chargeOutcome: ProducerChargeCompletionOutcome | undefined;
	deliveryItems: readonly ProducerDeliveryItem[];
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { config, nowMs, save } = scope;
	const placementRequests = toPlacementRequests({
		items: deliveryItems,
		itemInstanceId: liveJob.itemInstanceId,
	});
	const seedCell = yield* readBoardItemCellFx({
		itemInstanceId: liveJob.itemInstanceId,
		save,
	});
	const freedBoardItemInstanceIds = chargeOutcome?.removeOnDepleted
		? new Set([
				liveJob.itemInstanceId,
			])
		: undefined;
	return yield* Effect.either(
		placeGameSaveItemsFx({
			config,
			freedBoardItemInstanceIds,
			items: placementRequests,
			nowMs,
			save,
			seedCell,
		}),
	);
});

const readPlacementSuccessEffectsFx = Effect.fn(
	"completeProducerJobFx.readPlacementSuccessEffectsFx",
)(function* ({
	chargeOutcome,
	liveJob,
	placementEvents,
	placementSave,
	scope,
}: {
	chargeOutcome: ProducerChargeCompletionOutcome | undefined;
	liveJob: GameSaveProducerJob;
	placementEvents: ProducerCompletionEvents;
	placementSave: GameSave;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs, save } = scope;
	if (!chargeOutcome?.removeOnDepleted) {
		return {
			chargeEvents: yield* spendProducerChargeCostAfterCompletedDeliveryFx({
				job: liveJob,
				nextSave: placementSave,
				scope,
			}),
			placementEvents,
		};
	}

	const producerItem = save.board.items[liveJob.itemInstanceId];
	if (!producerItem) {
		return {
			chargeEvents: [
				createProducerChargesDepletedRemovalEvent({
					job: liveJob,
					nowMs,
					producerId: chargeOutcome.producerId,
				}),
			] satisfies ProducerCompletionEvents,
			placementEvents,
		};
	}

	const replacedSource = yield* replaceDepletedProducerSourceCellOutputFx({
		events: placementEvents,
		job: liveJob,
		nextSave: placementSave,
		nowMs,
		producerItem,
	});
	if (replacedSource.replaced) {
		return {
			chargeEvents: [] satisfies ProducerCompletionEvents,
			placementEvents: replacedSource.events,
		};
	}

	yield* removeBoardItemFromSaveFx({
		itemInstanceId: liveJob.itemInstanceId,
		runtimeState: "remove",
		save: placementSave,
	});
	return {
		chargeEvents: [
			createProducerChargesDepletedRemovalEvent({
				job: liveJob,
				nowMs,
				producerId: chargeOutcome.producerId,
			}),
		] satisfies ProducerCompletionEvents,
		placementEvents: replacedSource.events,
	};
});

const completeProducerPlacementSuccessFx = Effect.fn(
	"completeProducerJobFx.completeProducerPlacementSuccessFx",
)(function* ({
	chargeOutcome,
	liveJob,
	placementResult,
	scope,
}: {
	chargeOutcome: ProducerChargeCompletionOutcome | undefined;
	liveJob: GameSaveProducerJob;
	placementResult: ProducerPlacementSuccess;
	scope: ProducerJobCompletionScope;
}) {
	const { nowMs } = scope;
	yield* removeProducerJobFromSaveFx({
		jobId: liveJob.id,
		save: placementResult.save,
	});
	const { chargeEvents, placementEvents } = yield* readPlacementSuccessEffectsFx({
		chargeOutcome,
		liveJob,
		placementEvents: placementResult.events,
		placementSave: placementResult.save,
		scope,
	});
	yield* rescheduleQueueAfterCompletedDeliveryFx({
		liveJob,
		nextSave: placementResult.save,
		resumeAtMs: nowMs,
		scope,
	});
	placementResult.save.updatedAtMs = nowMs;

	return createCompletedResult({
		chargeEvents,
		job: liveJob,
		nowMs,
		placementEvents,
		save: placementResult.save,
	});
});

const completeProducerJobWithDeliveryItemsFx = Effect.fn(
	"completeProducerJobFx.completeProducerJobWithDeliveryItemsFx",
)(function* ({
	deliveryItems,
	liveJob,
	scope,
}: {
	deliveryItems: readonly ProducerDeliveryItem[];
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { save } = scope;
	const chargeOutcome = yield* readProducerChargeCompletionOutcomeFx({
		job: liveJob,
		save,
		scope,
	});
	const placementEither = yield* readProducerPlacementEitherFx({
		chargeOutcome,
		deliveryItems,
		liveJob,
		scope,
	});

	return yield* match(placementEither)
		.with(
			{
				_tag: "Left",
			},
			({ left }) => {
				if (left._tag !== "GamePlacementFailed") return Effect.fail(left);
				return completeProducerPlacementFailureFx({
					error: left,
					liveJob,
					scope,
				});
			},
		)
		.with(
			{
				_tag: "Right",
			},
			({ right }) =>
				completeProducerPlacementSuccessFx({
					chargeOutcome,
					liveJob,
					placementResult: right,
					scope,
				}),
		)
		.exhaustive();
});

const completeLiveProducerJobFx = Effect.fn("completeProducerJobFx.completeLiveProducerJobFx")(
	function* ({
		liveJob,
		scope,
	}: {
		liveJob: GameSaveProducerJob;
		scope: ProducerJobCompletionScope;
	}) {
		const line = yield* readLiveProducerLineFx({
			liveJob,
			scope,
		});
		yield* assertProducerLinePlacementSupportedFx(line);
		const deliveryItems = yield* rollProducerDeliveryItemsFx({
			job: liveJob,
			scope,
		});

		return yield* match(deliveryItems.length === 0)
			.with(true, () =>
				completeProducerJobWithoutDeliveryItemsFx({
					liveJob,
					scope,
				}),
			)
			.with(false, () =>
				completeProducerJobWithDeliveryItemsFx({
					deliveryItems,
					liveJob,
					scope,
				}),
			)
			.exhaustive();
	},
);

export const completeProducerJobFx = Effect.fn("completeProducerJobFx")(function* (
	scope: completeProducerJobFx.Props,
) {
	const liveJob = yield* readLiveProducerJobFx(scope);
	if (!liveJob) {
		return {
			events: [],
			save: scope.save,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	}

	return yield* completeLiveProducerJobFx({
		liveJob,
		scope,
	});
});
