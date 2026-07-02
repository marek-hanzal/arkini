import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProducerJobLine } from "~/v0/game/producer/readProducerJobLine";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobTimingFx } from "~/v0/game/producer/readProducerJobTimingFx";
import { findActiveEffectByProducerJobId } from "~/v0/game/effects/findActiveEffectByProducerJobId";
import { compareProducerQueueJobs } from "~/v0/game/producer/compareProducerQueueJobs";

export namespace rescheduleProducerQueueAfterBlockedDeliveryFx {
	export interface Props {
		blockedJobId: string;
		config: GameConfig;
		nextSave: GameSave;
		itemInstanceId: string;
		resumeAtMs: number;
	}
}

export const rescheduleProducerQueueAfterBlockedDeliveryFx = Effect.fn(
	"rescheduleProducerQueueAfterBlockedDeliveryFx",
)(function* ({
	blockedJobId,
	config,
	nextSave,
	itemInstanceId,
	resumeAtMs,
}: rescheduleProducerQueueAfterBlockedDeliveryFx.Props) {
	let cursorAtMs = resumeAtMs;
	const jobs = Object.values(nextSave.producerJobs)
		.filter((job) => job.itemInstanceId === itemInstanceId && job.id !== blockedJobId)
		.sort(compareProducerQueueJobs);
	const rescheduledProducerJobIds = new Set(jobs.map((job) => job.id));

	for (const job of jobs) {
		const nextStartAtMs = Math.max(job.startAtMs, cursorAtMs);
		if (nextStartAtMs === job.startAtMs) {
			cursorAtMs = job.readyAtMs;
			continue;
		}

		const timing = yield* readProducerJobTimingFx({
			config,
			ignoredProducerJobIds: rescheduledProducerJobIds,
			itemInstanceId: job.itemInstanceId,
			lineId: job.lineId,
			save: nextSave,
			startAtMs: nextStartAtMs,
		});
		nextSave.producerJobs[job.id] = {
			...job,
			readyAtMs: timing.readyAtMs,
			startAtMs: timing.startAtMs,
		};

		const line = readProducerJobLine({
			config,
			job,
			save: nextSave,
		});
		if (!line) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing line "${job.lineId}".`),
			);
		}
		if (line.activatesEffectId) {
			const activeEffect = findActiveEffectByProducerJobId({
				producerJobId: job.id,
				save: nextSave,
			});
			if (!activeEffect) {
				return yield* Effect.fail(
					GameEngineError.saveInvalid(
						`Producer job "${job.id}" activates effect "${line.activatesEffectId}" but has no active effect instance.`,
					),
				);
			}
			nextSave.activeEffects[activeEffect.id] = {
				...activeEffect,
				effectId: line.activatesEffectId,
				endAtMs: timing.readyAtMs,
				producerJobId: job.id,
				sourceItemInstanceId: job.itemInstanceId,
				startAtMs: timing.startAtMs,
			};
		}

		cursorAtMs = timing.readyAtMs;
	}
});
