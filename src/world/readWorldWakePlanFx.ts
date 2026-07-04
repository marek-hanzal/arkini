import { Context, Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
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

class WorldWakePlanScopeFx extends Context.Tag("WorldWakePlanScopeFx")<
	WorldWakePlanScopeFx,
	readWorldWakePlanFx.Props
>() {
	//
}

const sortWakeReasons = (left: WorldWakeReason, right: WorldWakeReason) =>
	left.atMs - right.atMs ||
	left.reason.localeCompare(right.reason) ||
	JSON.stringify(left.entity).localeCompare(JSON.stringify(right.entity));

const readItemSpawnJobWakeReasonsFx = Effect.fn(
	"readWorldWakePlanFx.readItemSpawnJobWakeReasonsFx",
)(function* () {
	const { nowMs, save } = yield* WorldWakePlanScopeFx;
	return Object.values(save.itemSpawnJobs).flatMap((job): WorldWakeReason[] => {
		if (
			isItemSpawnJobWaitingForDependencies({
				job,
				save,
			})
		) {
			return [];
		}

		return [
			{
				atMs: readProcessableWorldWakeAtMs({
					nowMs,
					readyAtMs: job.readyAtMs,
				}),
				entity: {
					id: job.id,
					kind: "itemSpawnJob",
				},
				reason: "item_spawn_ready",
			},
		];
	});
});

const readProducerQueueWakeReasonsFx = Effect.fn(
	"readWorldWakePlanFx.readProducerQueueWakeReasonsFx",
)(function* () {
	const { nowMs, save } = yield* WorldWakePlanScopeFx;
	return readWorldProducerJobFacts({
		nowMs,
		save,
	}).flatMap((producerJobFacts): WorldWakeReason[] => {
		if (producerJobFacts.releaseAtMs === undefined) return [];

		return [
			{
				atMs: readProcessableWorldWakeAtMs({
					nowMs,
					readyAtMs: producerJobFacts.releaseAtMs,
				}),
				entity: {
					id: producerJobFacts.job.id,
					kind: "producerJob",
				},
				reason: "producer_queue_ready",
			},
		];
	});
});

const readActiveEffectWakeReasonsFx = Effect.fn(
	"readWorldWakePlanFx.readActiveEffectWakeReasonsFx",
)(function* () {
	const { config, nowMs, save } = yield* WorldWakePlanScopeFx;
	return readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	}).flatMap((effectFacts): WorldWakeReason[] => {
		if (
			effectFacts.status === "producer_paused" ||
			effectFacts.status === "blocked_by_paused_queue_head"
		) {
			return [];
		}

		return [
			...(nowMs === undefined || effectFacts.status === "scheduled"
				? [
						{
							atMs: effectFacts.effect.startAtMs,
							entity: {
								id: effectFacts.effect.id,
								kind: "activeEffect" as const,
							},
							reason: "active_effect_start" as const,
						},
					]
				: []),
			{
				atMs: readProcessableWorldWakeAtMs({
					nowMs,
					readyAtMs: effectFacts.effect.endAtMs,
				}),
				entity: {
					id: effectFacts.effect.id,
					kind: "activeEffect",
				},
				reason: "active_effect_end",
			},
		];
	});
});

const readCraftJobWakeReasonsFx = Effect.fn("readWorldWakePlanFx.readCraftJobWakeReasonsFx")(
	function* () {
		const { nowMs, save } = yield* WorldWakePlanScopeFx;
		return readWorldCraftJobFacts({
			nowMs,
			save,
		}).flatMap((craftJobFacts): WorldWakeReason[] => {
			if (craftJobFacts.releaseAtMs === undefined) return [];

			return [
				{
					atMs: readProcessableWorldWakeAtMs({
						nowMs,
						readyAtMs: craftJobFacts.releaseAtMs,
					}),
					entity: {
						id: craftJobFacts.job.id,
						kind: "craftJob",
					},
					reason: "craft_ready",
				},
			];
		});
	},
);

const readAllWakeReasonsFx = Effect.fn("readWorldWakePlanFx.readAllWakeReasonsFx")(function* () {
	const wakeReasonGroups = yield* Effect.all([
		readItemSpawnJobWakeReasonsFx(),
		readProducerQueueWakeReasonsFx(),
		readActiveEffectWakeReasonsFx(),
		readCraftJobWakeReasonsFx(),
	]);
	return wakeReasonGroups.flat().sort(sortWakeReasons);
});

export const readWorldWakePlanFx = Effect.fn("readWorldWakePlanFx")(function* (
	props: readWorldWakePlanFx.Props,
) {
	return yield* Effect.gen(function* () {
		const wakeReasons = yield* readAllWakeReasonsFx();
		return {
			nextWakeAtMs: readMinGameWakeAtMs({
				nowMs: props.nowMs,
				values: wakeReasons.map((reason) => reason.atMs),
			}),
			wakeReasons,
		} satisfies WorldWakePlanFacts;
	}).pipe(Effect.provideService(WorldWakePlanScopeFx, props));
});
