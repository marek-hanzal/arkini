import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldSnapshotFactsFx } from "~/v0/game/world/readWorldSnapshotFactsFx";
import type { WorldCheckIssue } from "~/v0/game/world/WorldCheckIssue";
import type { WorldSnapshotCheckId } from "~/v0/game/world/WorldSnapshotCheckId";

export namespace validateWorldSnapshotFx {
	export interface Props {
		checks?: readonly WorldSnapshotCheckId[];
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const includesCheck = ({
	checks,
	id,
}: {
	checks?: readonly WorldSnapshotCheckId[];
	id: WorldSnapshotCheckId;
}) => !checks || checks.includes(id);

export const validateWorldSnapshotFx = Effect.fn("validateWorldSnapshotFx")(function* ({
	checks,
	config,
	nowMs,
	save,
}: validateWorldSnapshotFx.Props) {
	const issues: WorldCheckIssue[] = [];
	const facts = yield* readWorldSnapshotFactsFx({
		config,
		nowMs,
		save,
	});

	if (
		includesCheck({
			checks,
			id: "job-delivery",
		})
	) {
		for (const producerJobFacts of facts.producerJobs) {
			const { job } = producerJobFacts;
			if (!job.delivery || job.delivery.lastBlockedAtMs >= job.readyAtMs) continue;
			issues.push({
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
			});
		}

		for (const craftJobFacts of facts.craftJobs) {
			const { job } = craftJobFacts;
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
	}

	if (
		includesCheck({
			checks,
			id: "producer-queues",
		})
	) {
		for (const producerJobFacts of facts.producerJobs) {
			const { job } = producerJobFacts;
			if (job.delivery && producerJobFacts.queueIndex !== 0) {
				issues.push({
					code: "producer_queue_delivery_not_head",
					entity: {
						id: job.id,
						kind: "producerJob",
					},
					evidence: {
						itemInstanceId: producerJobFacts.itemInstanceId,
						queueIndex: producerJobFacts.queueIndex,
					},
					message: `Producer job "${job.id}" has blocked delivery but is not the queue head.`,
					severity: "error",
				});
			}

			if (job.delivery && (job.pausedAtMs !== undefined || job.remainingMs !== undefined)) {
				issues.push({
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
				});
			}

			if (producerJobFacts.previousJobId) {
				const previousFacts = facts.producerJobs.find(
					(candidate) => candidate.job.id === producerJobFacts.previousJobId,
				);
				if (
					previousFacts?.releaseAtMs !== undefined &&
					job.startAtMs < previousFacts.releaseAtMs
				) {
					issues.push({
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
					});
				}
			}
		}
	}

	if (
		includesCheck({
			checks,
			id: "active-effects",
		})
	) {
		for (const effectFacts of facts.activeEffects) {
			if (!effectFacts.producerJobId) continue;
			const producerJobFacts = facts.producerJobs.find(
				(candidate) => candidate.job.id === effectFacts.producerJobId,
			);
			if (!producerJobFacts) continue;
			if (producerJobFacts.job.delivery) {
				issues.push({
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
				});
				continue;
			}
			if (effectFacts.status !== "active") continue;
			if (producerJobFacts.status !== "running" && producerJobFacts.status !== "ready") {
				issues.push({
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
				});
			}
		}
	}

	if (
		includesCheck({
			checks,
			id: "replacement-safety",
		})
	) {
		for (const replacementFacts of facts.replacementSafety) {
			if (
				!replacementFacts.blockReasons.includes("craft_job") ||
				!replacementFacts.blockReasons.includes("producer_job")
			) {
				continue;
			}
			const craftJobIds = Object.values(save.craftJobs)
				.filter((job) => job.targetItemInstanceId === replacementFacts.itemInstanceId)
				.map((job) => job.id);
			const producerJobIds = Object.values(save.producerJobs)
				.filter((job) => job.itemInstanceId === replacementFacts.itemInstanceId)
				.map((job) => job.id);
			issues.push({
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
			});
		}
	}

	return {
		facts,
		issues,
	};
});
