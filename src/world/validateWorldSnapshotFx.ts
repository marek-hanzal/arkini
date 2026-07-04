import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldSnapshotFactsFx } from "~/world/readWorldSnapshotFactsFx";
import type { WorldActiveEffectFacts } from "~/world/WorldActiveEffectFacts";
import type { WorldCheckIssue } from "~/world/WorldCheckIssue";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";
import type { WorldReplacementSafetyFacts } from "~/world/WorldReplacementSafetyFacts";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";

export namespace validateWorldSnapshotFx {
	export interface Props {
		checks?: readonly WorldSnapshotCheckId[];
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const allWorldSnapshotCheckIds = [
	"job-delivery",
	"producer-queues",
	"active-effects",
	"replacement-safety",
] as const satisfies readonly WorldSnapshotCheckId[];

type WorldSnapshotValidationScope = {
	checks?: readonly WorldSnapshotCheckId[];
	facts: WorldSnapshotFacts;
	save: GameSave;
};

const readSelectedCheckIdsFx = Effect.fn("validateWorldSnapshotFx.readSelectedCheckIdsFx")(
	function* ({ checks }: WorldSnapshotValidationScope) {
		return checks ?? allWorldSnapshotCheckIds;
	},
);

const readProducerJobFactsByIdFx = Effect.fn("validateWorldSnapshotFx.readProducerJobFactsByIdFx")(
	function* ({ facts }: WorldSnapshotValidationScope) {
		return new Map(
			facts.producerJobs.map((producerJobFacts) => [
				producerJobFacts.job.id,
				producerJobFacts,
			]),
		);
	},
);

const createProducerDeliveryBeforeReadyIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createProducerDeliveryBeforeReadyIssueFx",
)(function* ({ job }: WorldProducerJobFacts) {
	if (!job.delivery || job.delivery.lastBlockedAtMs >= job.readyAtMs) return [];
	return [
		{
			code: "producer_delivery_before_ready",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				lastBlockedAtMs: job.delivery.lastBlockedAtMs,
				nextAttemptAtMs: job.delivery.nextAttemptAtMs,
				readyAtMs: job.readyAtMs,
			},
			message: `Producer job "${job.id}" has blocked delivery before it is ready.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const readProducerDeliveryBeforeReadyIssuesFx = Effect.fn(
	"validateWorldSnapshotFx.readProducerDeliveryBeforeReadyIssuesFx",
)(function* (scope: WorldSnapshotValidationScope) {
	const issues: WorldCheckIssue[] = [];
	for (const producerJobFacts of scope.facts.producerJobs) {
		issues.push(...(yield* createProducerDeliveryBeforeReadyIssueFx(producerJobFacts)));
	}
	return issues;
});

const readCraftDeliveryBeforeReadyIssuesFx = Effect.fn(
	"validateWorldSnapshotFx.readCraftDeliveryBeforeReadyIssuesFx",
)(function* (scope: WorldSnapshotValidationScope) {
	const issues: WorldCheckIssue[] = [];
	for (const { job } of scope.facts.craftJobs) {
		if (!job.delivery || job.delivery.lastBlockedAtMs >= job.readyAtMs) continue;
		issues.push({
			code: "craft_delivery_before_ready",
			entity: {
				id: job.id,
				kind: "craftJob",
			},
			evidence: {
				lastBlockedAtMs: job.delivery.lastBlockedAtMs,
				nextAttemptAtMs: job.delivery.nextAttemptAtMs,
				readyAtMs: job.readyAtMs,
			},
			message: `Craft job "${job.id}" has blocked delivery before it is ready.`,
			severity: "error",
		});
	}
	return issues;
});

const readJobDeliveryIssuesFx = Effect.fn("validateWorldSnapshotFx.readJobDeliveryIssuesFx")(
	function* (scope: WorldSnapshotValidationScope) {
		return [
			...(yield* readProducerDeliveryBeforeReadyIssuesFx(scope)),
			...(yield* readCraftDeliveryBeforeReadyIssuesFx(scope)),
		];
	},
);

const createProducerQueueDeliveryHeadIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createProducerQueueDeliveryHeadIssueFx",
)(function* ({ itemInstanceId, job, queueIndex }: WorldProducerJobFacts) {
	if (!job.delivery || queueIndex === 0) return [];
	return [
		{
			code: "producer_queue_delivery_not_head",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				itemInstanceId,
				queueIndex,
			},
			message: `Producer job "${job.id}" has blocked delivery but is not the queue head.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createProducerDeliveryPausedIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createProducerDeliveryPausedIssueFx",
)(function* ({ job }: WorldProducerJobFacts) {
	if (!job.delivery || (job.pausedAtMs === undefined && job.remainingMs === undefined)) return [];
	return [
		{
			code: "delivery_job_paused",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				pausedAtMs: job.pausedAtMs,
				remainingMs: job.remainingMs,
			},
			message: `Producer delivery job "${job.id}" must not also be paused.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createProducerQueueBarrierIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createProducerQueueBarrierIssueFx",
)(function* ({
	producerJobFacts,
	scope,
}: {
	producerJobFacts: WorldProducerJobFacts;
	scope: WorldSnapshotValidationScope;
}) {
	const { job, previousJobId } = producerJobFacts;
	if (!previousJobId) return [];
	const producerJobFactsById = yield* readProducerJobFactsByIdFx(scope);
	const previousFacts = producerJobFactsById.get(previousJobId);
	if (previousFacts?.releaseAtMs === undefined || job.startAtMs >= previousFacts.releaseAtMs) {
		return [];
	}

	return [
		{
			code: "producer_job_starts_before_queue_barrier",
			entity: {
				id: job.id,
				kind: "producerJob",
			},
			evidence: {
				previousJobId: previousFacts.job.id,
				previousReleaseAtMs: previousFacts.releaseAtMs,
				startAtMs: job.startAtMs,
			},
			message: `Producer job "${job.id}" starts before previous queue job "${previousFacts.job.id}" releases.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const readProducerQueueIssuesFx = Effect.fn("validateWorldSnapshotFx.readProducerQueueIssuesFx")(
	function* (scope: WorldSnapshotValidationScope) {
		const issues: WorldCheckIssue[] = [];
		for (const producerJobFacts of scope.facts.producerJobs) {
			issues.push(...(yield* createProducerQueueDeliveryHeadIssueFx(producerJobFacts)));
			issues.push(...(yield* createProducerDeliveryPausedIssueFx(producerJobFacts)));
			issues.push(
				...(yield* createProducerQueueBarrierIssueFx({
					producerJobFacts,
					scope,
				})),
			);
		}
		return issues;
	},
);

const createActiveEffectDeliveryJobIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createActiveEffectDeliveryJobIssueFx",
)(function* ({
	effectFacts,
	producerJobFacts,
}: {
	effectFacts: WorldActiveEffectFacts;
	producerJobFacts: WorldProducerJobFacts;
}) {
	if (!producerJobFacts.job.delivery) return [];
	return [
		{
			code: "active_effect_delivery_job_linked",
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			evidence: {
				producerJobId: effectFacts.producerJobId,
				producerStatus: producerJobFacts.status,
				status: effectFacts.status,
			},
			message: `Active effect "${effectFacts.effect.id}" is linked to completed delivery job "${effectFacts.producerJobId}".`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createActiveEffectApplyStateIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createActiveEffectApplyStateIssueFx",
)(function* ({
	effectFacts,
	producerJobFacts,
}: {
	effectFacts: WorldActiveEffectFacts;
	producerJobFacts: WorldProducerJobFacts;
}) {
	if (effectFacts.status !== "active") return [];
	if (producerJobFacts.status === "running" || producerJobFacts.status === "ready") return [];
	return [
		{
			code: "active_effect_apply_state_invalid",
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			evidence: {
				producerJobId: effectFacts.producerJobId,
				producerStatus: producerJobFacts.status,
				status: effectFacts.status,
			},
			message: `Active effect "${effectFacts.effect.id}" applies while linked producer job "${effectFacts.producerJobId}" is ${producerJobFacts.status}.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const createActiveEffectProducerIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createActiveEffectProducerIssueFx",
)(function* ({
	effectFacts,
	scope,
}: {
	effectFacts: WorldActiveEffectFacts;
	scope: WorldSnapshotValidationScope;
}) {
	if (!effectFacts.producerJobId) return [];
	const producerJobFactsById = yield* readProducerJobFactsByIdFx(scope);
	const producerJobFacts = producerJobFactsById.get(effectFacts.producerJobId);
	if (!producerJobFacts) return [];
	const deliveryIssues = yield* createActiveEffectDeliveryJobIssueFx({
		effectFacts,
		producerJobFacts,
	});
	return deliveryIssues.length > 0
		? deliveryIssues
		: yield* createActiveEffectApplyStateIssueFx({
				effectFacts,
				producerJobFacts,
			});
});

const readActiveEffectIssuesFx = Effect.fn("validateWorldSnapshotFx.readActiveEffectIssuesFx")(
	function* (scope: WorldSnapshotValidationScope) {
		const issues: WorldCheckIssue[] = [];
		for (const effectFacts of scope.facts.activeEffects) {
			issues.push(
				...(yield* createActiveEffectProducerIssueFx({
					effectFacts,
					scope,
				})),
			);
		}
		return issues;
	},
);

const createReplacementSafetyIssueFx = Effect.fn(
	"validateWorldSnapshotFx.createReplacementSafetyIssueFx",
)(function* ({
	replacementFacts,
	scope,
}: {
	replacementFacts: WorldReplacementSafetyFacts;
	scope: WorldSnapshotValidationScope;
}) {
	if (
		!replacementFacts.blockReasons.includes("craft_job") ||
		!replacementFacts.blockReasons.includes("producer_job")
	) {
		return [];
	}

	const craftJobIds = Object.values(scope.save.craftJobs)
		.filter((job) => job.targetItemInstanceId === replacementFacts.itemInstanceId)
		.map((job) => job.id);
	const producerJobIds = Object.values(scope.save.producerJobs)
		.filter((job) => job.itemInstanceId === replacementFacts.itemInstanceId)
		.map((job) => job.id);
	return [
		{
			code: "craft_and_producer_share_target",
			entity: {
				id: replacementFacts.itemInstanceId,
				kind: "boardItem",
			},
			evidence: {
				blockReasons: replacementFacts.blockReasons,
				craftJobIds,
				producerJobIds,
			},
			message: `Board item "${replacementFacts.itemInstanceId}" has both craft and producer runtime jobs.`,
			severity: "error",
		},
	] satisfies WorldCheckIssue[];
});

const readReplacementSafetyIssuesFx = Effect.fn(
	"validateWorldSnapshotFx.readReplacementSafetyIssuesFx",
)(function* (scope: WorldSnapshotValidationScope) {
	const issues: WorldCheckIssue[] = [];
	for (const replacementFacts of scope.facts.replacementSafety) {
		issues.push(
			...(yield* createReplacementSafetyIssueFx({
				replacementFacts,
				scope,
			})),
		);
	}
	return issues;
});

const readWorldSnapshotCheckIssuesFx = Effect.fn(
	"validateWorldSnapshotFx.readWorldSnapshotCheckIssuesFx",
)(function* ({
	checkId,
	scope,
}: {
	checkId: WorldSnapshotCheckId;
	scope: WorldSnapshotValidationScope;
}) {
	return yield* match(checkId)
		.with("job-delivery", () => readJobDeliveryIssuesFx(scope))
		.with("producer-queues", () => readProducerQueueIssuesFx(scope))
		.with("active-effects", () => readActiveEffectIssuesFx(scope))
		.with("replacement-safety", () => readReplacementSafetyIssuesFx(scope))
		.exhaustive();
});

const readWorldSnapshotIssuesFx = Effect.fn("validateWorldSnapshotFx.readWorldSnapshotIssuesFx")(
	function* (scope: WorldSnapshotValidationScope) {
		const checkIds = yield* readSelectedCheckIdsFx(scope);
		const issues: WorldCheckIssue[] = [];
		for (const checkId of checkIds) {
			issues.push(
				...(yield* readWorldSnapshotCheckIssuesFx({
					checkId,
					scope,
				})),
			);
		}
		return issues;
	},
);

export const validateWorldSnapshotFx = Effect.fn("validateWorldSnapshotFx")(function* ({
	checks,
	config,
	nowMs,
	save,
}: validateWorldSnapshotFx.Props) {
	const facts = yield* readWorldSnapshotFactsFx({
		config,
		nowMs,
		save,
	});
	const issues = yield* readWorldSnapshotIssuesFx({
		checks,
		facts,
		save,
	});

	return {
		facts,
		issues,
	};
});
