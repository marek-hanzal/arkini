import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { isGameTimeDue } from "~/v0/game/time/GameTime";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";

export namespace processExpiredActiveEffectsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const processExpiredActiveEffectsFx = Effect.fn("processExpiredActiveEffectsFx")(function* ({
	config,
	nowMs,
	save,
}: processExpiredActiveEffectsFx.Props) {
	const expiredEffects = readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	})
		.filter(
			(effectFacts) =>
				effectFacts.status !== "producer_paused" &&
				effectFacts.status !== "blocked_by_paused_queue_head",
		)
		.map((effectFacts) => effectFacts.effect)
		.filter((effect) =>
			isGameTimeDue({
				nowMs,
				readyAtMs: effect.endAtMs,
			}),
		)
		.sort(
			(left, right) =>
				left.endAtMs - right.endAtMs ||
				left.startAtMs - right.startAtMs ||
				left.id.localeCompare(right.id),
		);

	if (expiredEffects.length === 0) {
		return {
			events: [],
			nextWakeAtMs: null,
			save,
		} satisfies GameEngineResult;
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	for (const effect of expiredEffects) {
		delete nextSave.activeEffects[effect.id];
		events.push({
			effectId: effect.effectId,
			atMs: nowMs,
			id: effect.id,
			producerJobId: effect.producerJobId,
			sourceItemInstanceId: effect.sourceItemInstanceId,
			type: "effect.expired" as const,
		});
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		nextWakeAtMs: null,
		save: nextSave,
	} satisfies GameEngineResult;
});
