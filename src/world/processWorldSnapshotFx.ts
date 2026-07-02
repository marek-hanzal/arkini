import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { processCompletedCraftJobsFx } from "~/craft/processCompletedCraftJobsFx";
import { processExpiredActiveEffectsFx } from "~/effects/processExpiredActiveEffectsFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { processItemSpawnJobsFx } from "~/job/processItemSpawnJobsFx";
import { processCompletedProducerJobsFx } from "~/producer/processCompletedProducerJobsFx";
import { readWorldWakePlanFx } from "~/world/readWorldWakePlanFx";

export namespace processWorldSnapshotFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}

	export interface Result {
		events: GameEvent[];
		nextWakeAtMs: number | null;
		save: GameSave;
	}
}

export const processWorldSnapshotFx = Effect.fn("processWorldSnapshotFx")(function* ({
	config,
	nowMs,
	save,
}: processWorldSnapshotFx.Props) {
	let nextSave = save;
	const events: GameEvent[] = [];

	const itemSpawnBeforeJobs = yield* processItemSpawnJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = itemSpawnBeforeJobs.save;
	events.push(...itemSpawnBeforeJobs.events);

	const producerJobs = yield* processCompletedProducerJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = producerJobs.save;
	events.push(...producerJobs.events);

	const craftJobs = yield* processCompletedCraftJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = craftJobs.save;
	events.push(...craftJobs.events);

	const producerJobsAfterCraft = yield* processCompletedProducerJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = producerJobsAfterCraft.save;
	events.push(...producerJobsAfterCraft.events);

	const activeEffects = yield* processExpiredActiveEffectsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = activeEffects.save;
	events.push(...activeEffects.events);

	const wakePlan = yield* readWorldWakePlanFx({
		config,
		nowMs,
		save: nextSave,
	});

	return {
		events,
		nextWakeAtMs: wakePlan.nextWakeAtMs,
		save: nextSave,
	} satisfies processWorldSnapshotFx.Result;
});
