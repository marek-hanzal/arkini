import { Effect } from "effect";
import { GameConfigFx } from "~/v0/game/config/GameConfigFx";
import { processCompletedCraftJobsFx } from "~/v0/game/craft/processCompletedCraftJobsFx";
import { processCompletedProducerJobsFx } from "~/v0/game/producer/processCompletedProducerJobsFx";
import { processItemSpawnJobsFx } from "~/v0/game/job/processItemSpawnJobsFx";
import { processExpiredActiveEffectsFx } from "~/v0/game/effects/processExpiredActiveEffectsFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace runGameTickFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const runGameTickFx = Effect.fn("runGameTickFx")(function* ({
	config,
	save,
	nowMs,
}: runGameTickFx.Props) {
	const result = Effect.gen(function* () {
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

		const activeEffects = yield* processExpiredActiveEffectsFx({
			nowMs,
			save: nextSave,
		});
		nextSave = activeEffects.save;
		events.push(...activeEffects.events);

		return {
			events,
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				nowMs,
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	});

	return yield* Effect.provideService(result, GameConfigFx, {
		config,
	});
});
