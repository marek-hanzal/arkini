import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readMinGameWakeAtMs } from "~/time/GameTime";
import { isItemSpawnJobWaitingForDependencies } from "~/world/isItemSpawnJobWaitingForDependencies";
import { readProcessableWorldWakeAtMs } from "~/world/readProcessableWorldWakeAtMs";
import { readWorldActiveEffectFacts } from "~/world/readWorldActiveEffectFacts";
import { readWorldCraftJobFacts } from "~/world/readWorldCraftJobFacts";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import type { WorldWakePlanFacts } from "~/world/WorldWakePlanFacts";
import type { WorldWakeReason } from "~/world/WorldWakeReason";

export namespace readWorldWakePlanFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

const sortWakeReasons = (left: WorldWakeReason, right: WorldWakeReason) =>
	left.atMs - right.atMs ||
	left.reason.localeCompare(right.reason) ||
	JSON.stringify(left.entity).localeCompare(JSON.stringify(right.entity));

export const readWorldWakePlanFx = Effect.fn("readWorldWakePlanFx")(function* ({
	config,
	nowMs,
	save,
}: readWorldWakePlanFx.Props): Generator<never, WorldWakePlanFacts> {
	const wakeReasons: WorldWakeReason[] = [];

	for (const job of Object.values(save.itemSpawnJobs)) {
		if (
			isItemSpawnJobWaitingForDependencies({
				job,
				save,
			})
		) {
			continue;
		}

		wakeReasons.push({
			atMs: readProcessableWorldWakeAtMs({
				nowMs,
				readyAtMs: job.readyAtMs,
			}),
			entity: {
				id: job.id,
				kind: "itemSpawnJob",
			},
			reason: "item_spawn_ready",
		});
	}

	for (const producerJobFacts of readWorldProducerJobFacts({
		nowMs,
		save,
	})) {
		if (producerJobFacts.releaseAtMs === undefined) continue;
		wakeReasons.push({
			atMs: readProcessableWorldWakeAtMs({
				nowMs,
				readyAtMs: producerJobFacts.releaseAtMs,
			}),
			entity: {
				id: producerJobFacts.job.id,
				kind: "producerJob",
			},
			reason: "producer_queue_ready",
		});
	}

	for (const effectFacts of readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	})) {
		if (
			effectFacts.status === "producer_paused" ||
			effectFacts.status === "blocked_by_paused_queue_head"
		) {
			continue;
		}

		if (nowMs === undefined || effectFacts.status === "scheduled") {
			wakeReasons.push({
				atMs: effectFacts.effect.startAtMs,
				entity: {
					id: effectFacts.effect.id,
					kind: "activeEffect",
				},
				reason: "active_effect_start",
			});
		}

		wakeReasons.push({
			atMs: readProcessableWorldWakeAtMs({
				nowMs,
				readyAtMs: effectFacts.effect.endAtMs,
			}),
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			reason: "active_effect_end",
		});
	}

	for (const craftJobFacts of readWorldCraftJobFacts({
		nowMs,
		save,
	})) {
		if (craftJobFacts.releaseAtMs === undefined) continue;

		wakeReasons.push({
			atMs: readProcessableWorldWakeAtMs({
				nowMs,
				readyAtMs: craftJobFacts.releaseAtMs,
			}),
			entity: {
				id: craftJobFacts.job.id,
				kind: "craftJob",
			},
			reason: "craft_ready",
		});
	}

	const sortedWakeReasons = [
		...wakeReasons,
	].sort(sortWakeReasons);

	return {
		nextWakeAtMs: readMinGameWakeAtMs({
			nowMs,
			values: sortedWakeReasons.map((reason) => reason.atMs),
		}),
		wakeReasons: sortedWakeReasons,
	};
});
