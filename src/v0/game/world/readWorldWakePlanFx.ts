import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readCraftJobWakeAtMs } from "~/v0/game/craft/craftCompletionTiming";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readMinGameWakeAtMs } from "~/v0/game/time/GameTime";
import { isItemSpawnJobWaitingForDependencies } from "~/v0/game/world/isItemSpawnJobWaitingForDependencies";
import { readProcessableWorldWakeAtMs } from "~/v0/game/world/readProcessableWorldWakeAtMs";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import type { WorldWakePlanFacts } from "~/v0/game/world/WorldWakePlanFacts";
import type { WorldWakeReason } from "~/v0/game/world/WorldWakeReason";

export namespace readWorldWakePlanFx {
	export interface Props {
		config?: GameConfig;
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

	for (const effectFacts of config
		? readWorldActiveEffectFacts({
				config,
				nowMs,
				save,
			})
		: Object.values(save.activeEffects ?? {}).map((effect) => ({
				effect,
				status: "active" as const,
			}))) {
		if (
			effectFacts.status === "producer_paused" ||
			effectFacts.status === "blocked_by_paused_queue_head"
		) {
			continue;
		}

		wakeReasons.push({
			atMs: effectFacts.effect.startAtMs,
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			reason: "active_effect_start",
		});
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

	for (const job of Object.values(save.craftJobs)) {
		wakeReasons.push({
			atMs: readProcessableWorldWakeAtMs({
				nowMs,
				readyAtMs: readCraftJobWakeAtMs(job),
			}),
			entity: {
				id: job.id,
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
