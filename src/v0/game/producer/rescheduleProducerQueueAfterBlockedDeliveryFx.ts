import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { rollProducerJobSnapshotFx } from "~/v0/game/producer/rollProducerJobSnapshotFx";

export namespace rescheduleProducerQueueAfterBlockedDeliveryFx {
	export interface Props {
		blockedJobId: string;
		config: GameConfig;
		nextSave: GameSave;
		producerItemInstanceId: string;
		resumeAtMs: number;
	}
}

const compareProducerQueueOrder = (left: GameSaveProducerJob, right: GameSaveProducerJob) =>
	left.startAtMs - right.startAtMs ||
	left.readyAtMs - right.readyAtMs ||
	left.id.localeCompare(right.id);

const findActiveEffectByProducerJobId = ({
	producerJobId,
	save,
}: {
	producerJobId: string;
	save: GameSave;
}) =>
	Object.values(save.activeEffects ?? {}).find(
		(effect) => effect.producerJobId === producerJobId,
	);

export const rescheduleProducerQueueAfterBlockedDeliveryFx = Effect.fn(
	"rescheduleProducerQueueAfterBlockedDeliveryFx",
)(function* ({
	blockedJobId,
	config,
	nextSave,
	producerItemInstanceId,
	resumeAtMs,
}: rescheduleProducerQueueAfterBlockedDeliveryFx.Props) {
	let cursorAtMs = resumeAtMs;
	const queuedJobs = Object.values(nextSave.producerJobs)
		.filter(
			(job) =>
				job.producerItemInstanceId === producerItemInstanceId && job.id !== blockedJobId,
		)
		.sort(compareProducerQueueOrder);

	for (const job of queuedJobs) {
		const nextStartAtMs = Math.max(job.startAtMs, cursorAtMs);
		if (nextStartAtMs === job.startAtMs) {
			cursorAtMs = job.readyAtMs;
			continue;
		}

		const snapshot = yield* rollProducerJobSnapshotFx({
			config,
			producerItemInstanceId: job.producerItemInstanceId,
			productId: job.productId,
			save: nextSave,
			startAtMs: nextStartAtMs,
		});
		nextSave.producerJobs[job.id] = {
			...job,
			outputItems: snapshot.outputItems,
			placement: snapshot.placement,
			readyAtMs: snapshot.readyAtMs,
			startAtMs: snapshot.startAtMs,
		};

		const product = config.products[job.productId];
		if (!product) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing product "${job.productId}".`),
			);
		}
		if (product.activatesEffectId) {
			const activeEffect = findActiveEffectByProducerJobId({
				producerJobId: job.id,
				save: nextSave,
			});
			if (!activeEffect) {
				return yield* Effect.fail(
					GameEngineError.saveInvalid(
						`Producer job "${job.id}" activates effect "${product.activatesEffectId}" but has no active effect instance.`,
					),
				);
			}
			nextSave.activeEffects[activeEffect.id] = {
				...activeEffect,
				effectId: product.activatesEffectId,
				endAtMs: snapshot.readyAtMs,
				producerJobId: job.id,
				sourceItemInstanceId: job.producerItemInstanceId,
				startAtMs: snapshot.startAtMs,
			};
		}

		cursorAtMs = snapshot.readyAtMs;
	}
});
